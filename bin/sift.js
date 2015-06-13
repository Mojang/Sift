#!/usr/bin/env node

var util = require('../util')
var commander = require('commander')
var omelette = require('omelette')
var config = util.load_config()
var pjson = require('../package.json')
var async = require('async')
var colors = require('colors')

if (!config) {
  return
}

var sub_command_count = 0
var subcommands = {}

Object.keys(config.alias).forEach(function (alias_key) {
  var i = 0
  var alias_split = alias_key.split(' ')
  var alias_length = alias_split.length
  
  if (sub_command_count < alias_length) {
    sub_command_count = alias_length
  }

  alias_split.forEach(function (the_split) {
    if (!subcommands[i]) {  
      subcommands[i] = i > 0 ? {} : []
    }

    if (i > 0) {
      if (!subcommands[i][alias_split[i - 1]]) {
        subcommands[i][alias_split[i - 1]] = []
      }

      subcommands[i][alias_split[i - 1]].push(the_split)
    } else {
      subcommands[i].push(the_split)
    }

    i++
  })
})

Object.keys(subcommands).forEach(function (subcommands_key) {
  if (subcommands_key === '0') {
    subcommands[subcommands_key] = util.deduplicate_array(subcommands[subcommands_key])
  } else {
    Object.keys(subcommands[subcommands_key]).forEach(function (sub_subcommands_key) {
      subcommands[subcommands_key][sub_subcommands_key] = util.deduplicate_array(subcommands[subcommands_key][sub_subcommands_key])
    })
  }
})

var basecommand = 'sift '

for (var i = 0; i < sub_command_count; i++) {
  basecommand += '<subcommand' + i + '> '
}

var complete = omelette(basecommand.trim())

complete.on('complete', function (fragment, word, line) {
  if (!fragment) {
    return
  }

  var split = fragment.split('subcommand')
  if (split && split.length) {
    var item = subcommands[split[1]]
    
    if (item) {
      if (split[1] === '0') {
        this.reply(item)
      } else {
        if (item && item[word]) {
          this.reply(item[word])
        }
      }
    }
  }
})

complete.init()

commander
  .version(pjson.version)
  // Actions
  .option('-l, --list_accounts', 'List accounts')
  .option('-k, --keys <key>', 'List searchable keys for a cloud provider')
  // Filters
  .option('-r, --region <region>', 'Aws region', util.list)
  .option('-a, --account <account>', 'Account name', util.list)
  .option('-t, --type <type>', 'Type of account', util.list)
  // Query shortcuts
  .option('-n, --servername <name>', 'Filter by name', util.list)
  .option('-H, --hostname <hostname>', 'Filter by hostname', util.list)
  .option('-i, --ip <ip>', 'Filter by ip', util.list)
  .option('-I, --image <image>', 'Filter by image id', util.list)
  .option('--id <id>', 'Filter by instance id', util.list)
  //Misc
  .option('-q, --query <query>', 'Query')
  .option('-e, --enable_filters <filter>', 'Enable specific filter(s)', util.list)
  // SSH options
  .option('-u, --user <user>', 'SSH user')
  .option('-p, --port <port>', 'SSH port')
  .option('-K, --keyfile <keyfile>', 'SSH keyfile')
  .option('-c, --ssh_command <ssh_command>', 'Command to execute')
  .option('-P, --private_ip', 'Use private ip when connecting')
  .option('--ansible <ansible_playbook>', 'Run an ansible playbook on target host(s)')
  // Boolean options
  .option('-A, --run_on_all', 'Execute on all found hosts')
  .option('-f, --force_regions', 'Use specified region for all accounts regardless of configured regions')
  .option('--autocompletion', 'Install autocompletion')
  .parse(process.argv)

if (commander.autocompletion) {
  console.log(colors.green('Done! You might need to restart your terminal'))
  complete.setupShellInitFile()
  return
}

var force_regions = commander.force_regions || config.force_regions

var alias

if (commander.args.length > 0) {
  if (config.alias[commander.args.join(' ')]) {
    alias = config.alias[commander.args.join(' ')]
  }
}

// Copy some options from config
commander.auto_connect_on_one_result = config.auto_connect_on_one_result
commander.ssh_config = config.ssh_config
commander.force_regions = force_regions
commander.ansible_dir = config.ansible_dir

var sift = require('../index')(commander, alias)

var parse_arguments = function () {
  var regions = []
  var accounts = []

  if (commander.region) {
    regions = commander.region
  }

  if (commander.account || (alias && alias.accounts)) {
    accounts = config.credentials.filter(function (account) {
      return util.contains_with_lowercase(account.name.toLowerCase(), commander.account ? commander.account : alias.accounts) || (account.public_token && util.contains_with_lowercase(account.public_token.toLowerCase(), commander.account ? commander.account : alias.accounts))
    })

    accounts = accounts.filter(util.check_account_type)

    if (!accounts.length) {
      return console.log('No accounts found with this name or public token'.red)
    }
  } else {
    if (!config.credentials || !config.credentials.length) {
      return console.log('No accounts defined in config'.red)
    }

    accounts = config.credentials.filter(util.check_account_type)
  }

  if (commander.type) {
    var valid_types = []

    commander.type.forEach(function (type) {
      if (config.plugins.indexOf(type.toLowerCase()) === -1) {
        console.log('Ignoring invalid type %s, valid types: [%s]'.red, type, config.plugins)
      } else {
        valid_types.push(type.toLowerCase())
      }
    })

    accounts = accounts.filter(function (account) {
      return util.contains(account.type.toLowerCase(), valid_types)
    })
  }

  if (!accounts.length) {
    return console.log('No valid accounts found'.red)
  }

  setup_filters(accounts, regions)
}

var setup_filters = function (accounts, regions) {
  var filters = ''
  var filter_list = []

  if (commander.enable_filters || (config.enabled_filters && config.enabled_filters.length)) {
    if (commander.enable_filters) {
      filter_list = filter_list.concat(commander.enable_filters.filter(function (filter) {
        if (config.allowed_filters.indexOf(filter.toLowerCase()) > -1) {
          return true
        } else {
          console.log('Ignoring invalid/disallowed filter %s'.red, filter)
          return false
        }
      }))
    }

    if (config.enabled_filters && config.enabled_filters.length) {
      filter_list = filter_list.concat(config.enabled_filters)
    }

    filter_list = util.deduplicate_array(filter_list)

    async.each(filter_list, function (filter, next) {
      try {
        require('../plugins/' + filter.toLowerCase()).filter(config, function (filter) {
          filters += filter
          next()
        })
      } catch (error) {
        next(error)
      }
    }, function (error) {
      if (error) {
        console.log('Something went wrong while setting up filters: %s'.red, error)
      }

      sift.gather_servers(accounts, regions, filters.trim())  
    })
  } else {
    sift.gather_servers(accounts, regions, filters)
  }
}

// Commands

if (commander.list_accounts) {
  config.credentials.forEach(function (account) {
    console.log('%s %s (%s)' + (account.public_token ? ' - %s' : ''), account.name.green, account.type.blue, colors.yellow(account.regions ? account.regions : require('../plugins/' + account.type).regions), account.public_token ? colors.red(account.public_token) : '')
  })
  return
}

if (commander.keys) {
  try {
    console.log("Keys for %s: %s".white, colors.blue(commander.keys), require('../plugins/' + commander.keys).keys.join(", "))
  } catch (error) {
    console.error('Provided type \'%s\' does not exist'.red, commander.keys)
  }
  return
}

parse_arguments()
