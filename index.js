#!/usr/bin/env node

var util = require('./util')
var colors = require('colors')
var commander = require('commander')
var parser = require('./query_parser')
var pjson = require('./package.json')
var async = require('async')
var readline = require('readline')
var path = require('path')
var fs = require('fs')

var config = util.load_config()
if (!config) {
  return
}

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
  .parse(process.argv)

var force_regions = commander.force_regions || config.force_regions

var alias

if (commander.args.length > 0) {
  if (config.alias[commander.args.join(' ')]) {
    alias = config.alias[commander.args.join(' ')]
  }
}

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
        require('./plugins/' + filter.toLowerCase()).filter(config, function (filter) {
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

      gather_servers(accounts, regions, filters.trim())  
    })
  } else {
    gather_servers(accounts, regions, filters)
  }
}

var gather_servers = function (accounts, regions, filters) {
  var accounts_to_use = []

  if (!regions || !regions.length) {
    regions = []
    accounts.forEach(function (account) {
      if (!account.regions) {
        account.regions = require('./plugins/' + account.type).regions
      }

      account.regions.forEach(function (region) {
        if (regions.indexOf(region) === -1) {
          regions.push(region)
        }
      })
    })
  }

  accounts.forEach(function (account) {
    if ((force_regions && commander.region) || (alias && alias.regions)) {
      account.regions = commander.region ? commander.region : alias.regions
      account.regions = account.regions.filter(function (region) {
        return require('./plugins/' + account.type).regions.indexOf(region) > -1
      })
    } else {
      if (!account.regions) {
        account.regions = require('./plugins/' + account.type).regions
      }

      account.regions = account.regions.filter(function (region) {
        return regions.indexOf(region) > -1
      })
    }

    if (account.regions.length) {
      accounts_to_use.push(account)
      console.log('Using %s account %s (%s)' + (account.public_token ? ' - %s' : '').green, colors.blue(account.type), colors.green(account.name), colors.yellow(account.regions), account.public_token ? colors.red(account.public_token) : '')
    }
  })

  if (!accounts_to_use.length) {
    return console.log('No accounts with correct regions found'.red)
  }

  async.concat(accounts_to_use, function (account, next) {
    util.find_servers(account, function callback (servers) {
      next(null, servers)
    })
  }, function (error, servers) {
    if (!servers.length) {
      return console.log('No matching servers found'.red)
    }

    filter_results(filters, servers)
  })
}

var filter_results = function (filters, servers) {
  if (commander.query || commander.region || commander.servername || commander.hostname || commander.image || commander.ip || commander.id || alias || (filters && filters.length)) {
    try {
      var query = parser.generate_query_ast_sync(build_query(filters))
    } catch (error) {
      console.log('Invalid query: %s'.red, error.message)
      return
    }

    async.concat(servers, function (server, next) {
      parser.match(JSON.parse(JSON.stringify(server)), query, function (error, matches) {
        next(error, matches ? server : [])
      })
    }, function (error, servers) {
      if (!servers.length) {
        return console.log('No matching servers found'.red)
      }

      display_results(servers)
    })
  } else {
    display_results(servers)
  }
}

var build_query = function (filters) {
  var query = ''

  if (commander.servername) {
    query += build_query_part('name', commander.servername)
  }

  if (commander.region) {
    query += build_query_part('region', commander.region)
  }

  if (commander.hostname) {
    query += build_query_part('hostname', commander.hostname)
  }

  if (commander.image) {
    query += build_query_part('image', commander.image)
  }

  if (commander.ip) {
    query += build_query_part('ip', commander.ip)
  }

  if (commander.id) {
    query += build_query_part('id', commander.id)
  }

  if (filters) {
    query += ' AND (' + filters + ')'
  }

  if (commander.query) {
    if (!query.length) {
      query += commander.query
    } else {
      query += ' AND (' + commander.query + ')'
    }
  }

  if (alias && alias.query) {
    query += ' AND (' + alias.query + ')'
  }

  query = query.trim()

  if (util.starts_with(query, 'AND')) {
    query = query.substring(3)
  }

  if (util.starts_with(query, 'OR')) {
    query = query.substring(2)
  }

  return query.trim()
}

var build_query_part = function (key_name, key) {
  var query = ' AND ('
  var split_count = key.length

  key.forEach(function (split) {
    split_count--

    query += key_name + ' CONTAINS' + ' \'' + split + '\''

    if (split_count) {
      query += ' OR '
    }
  })

  query += ')'

  return query
}

var display_results = function (result) {
  var color_index = 0
  var index = 0

  result.forEach(function (server) {
    require('./plugins/' + server.account.type).display(server, index+++1)
  })

  if (result.length == 1 && config.auto_connect_on_one_result) {
    return prepare_ssh(result[0], function (ssh_config) {
      if (commander.ansible) {
        ansible([{ server: result[0], ssh_config: ssh_config }])
      } else {
        ssh(result[0], ssh_config)
      }
    })
  }

  if ((((alias && alias.run_on_all) || commander.run_on_all) && ((alias && alias.command) || commander.ssh_command)) || (commander.ansible && commander.run_on_all)) {
    return async.mapSeries(result, function (server, next) {
      prepare_ssh(server, function (ssh_config) {
        var color = util.colors[color_index++]

        if (color_index > (util.colors.length - 1)) {
          color_index = 0
        }

        next(null, { server: server, ssh_config: ssh_config, disable_tt: color })
      })
    }, function (error, ssh_results) {
      if (commander.ansible) {
        ansible(ssh_results)
      } else {
        ssh_results.forEach(function (ssh_result) {
          ssh(ssh_result.server, ssh_result.ssh_config, ssh_result.disable_tt)
        })
      }
    })
  }

  var reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  reader.question("Which server do you want to connect to? ", function (index) {
    var server = result[index - 1]
    reader.close()

    if (!server) {
      return console.log('Invalid selection'.red)
    }

    prepare_ssh(server, function (ssh_config) {
      if (commander.ansible) {
        ansible([{ server: server, ssh_config: ssh_config }])
      } else {
        ssh(server, ssh_config)
      }
    })
  })
}

var prepare_ssh = function (server, callback) {
  var ssh_config

  if (!config.ssh_config.length) {
    return console.log('Please specify a default ssh config'.red)
  }

  function iterate_configs (the_config, next) {
    var account_match = false
    var query

    if (the_config.priority === 0) {
      ssh_config = the_config    
      return next()
    }

    if (the_config.accounts && (util.contains_with_lowercase(server.account.name.toLowerCase(), the_config.accounts) || (server.account.public_token && util.contains_with_lowercase(server.account.public_token.toLowerCase(), the_config.accounts)))) {
      account_match = true
    }

    if (!the_config.query) {
      if (account_match) {
        if (!ssh_config || the_config.priority > ssh_config.priority) {
          ssh_config = the_config
        }
      }

      return next()
    }

    try {
      query = parser.generate_query_ast_sync(the_config.query)
    } catch (error) {
      return console.log('Invalid ssh config query: %s'.red, error.message)
    }

    parser.match(JSON.parse(JSON.stringify(server)), query, function (error, matches) {
      if (error) {
        return console.log('Error parsing with ssh config query %s'.red, error)
      }

      if (matches) {
        if ((the_config.accounts && account_match) || !the_config.accounts) {
          if (!ssh_config || the_config.priority > ssh_config.priority) {
            ssh_config = the_config
          }
        }
      }

      next(error)
    })
  }

  function next (error) {
    callback(ssh_config)
  }

  async.each(config.ssh_config, iterate_configs, next)
}

var ssh = function (server, ssh_config, disable_tt) {
  // TODO Merge default conf with ssh config, config option?
  if (ssh_config) {
    return require('./plugins/' + server.account.type).ssh(server, build_ssh_config(ssh_config, disable_tt))
  }

  console.log('No matching ssh config, please specify a default ssh config'.red)
}

var ansible = function (servers) {
  var inventory_file = path.resolve(config.ansible_dir, (new Date()).valueOf().toString() + '.sh')

  var ansible_inventory = {
    all: {
      hosts: [],
      vars: {
        "ansible_connection": "ssh"
      }
    },
    _meta: {
      hostvars: {}
    }
  }

  servers.forEach(function (server) {
    server.ssh_config = build_ssh_config(server.ssh_config)
    var hostname = (server.ssh_config.private_ip ? server.server['private-ip'] : server.server.hostname)
    
    ansible_inventory.all.hosts.push(hostname)
    
    var options = {
      ansible_ssh_user: server.ssh_config.user
    }

    if (server.ssh_config.port) {
      options.ansible_ssh_port = server.ssh_config.port
    }

    if (server.ssh_config.keyfile) {
      options.ansible_ssh_private_key_file = server.ssh_config.keyfile
    }

    ansible_inventory._meta.hostvars[hostname] = options
  })

  fs.mkdir(config.ansible_dir, function (error) {})
  fs.writeFileSync(inventory_file, '#!/bin/sh\necho \'' + JSON.stringify(ansible_inventory) + '\'', 'utf8')
  fs.chmodSync(inventory_file, 0755)

  var child = require('child_process').spawn('ansible-playbook', [commander.ansible, '-i', inventory_file], { stdio: 'inherit' })
  child.on('exit', function (code, signal) {
    fs.unlink(inventory_file, function (error) {
      if (error) {
        console.log('Error removing ansible inventory: %s', inventory_file)
      }
    })
  })
}

var build_ssh_config = function (ssh_config, disable_tt) {
  var options = {
    user: ssh_config.user,
    port: ssh_config.port,
    keyfile: ssh_config.keyfile,
    command: ssh_config.command,
    disable_tt: disable_tt,
    private_ip: ssh_config.private_ip,
    extra_options: []
  }

  if (alias && alias.user) {
    options.user = alias.user
  }

  if (commander.user) {
    options.user = commander.user
  }

  if (alias && alias.port) {
    options.port = alias.port
  }

  if (commander.port) {
    options.port = commander.port
  }

  if (alias && alias.keyfile) {
    options.keyfile = alias.keyfile
  }

  if (commander.keyfile) {
    options.keyfile = commander.keyfile
  }

  if (alias && alias.command) {
    options.command = alias.command
  }

  if (commander.ssh_command) {
    options.command = commander.ssh_command
  }

  if (alias && alias.private_ip) {
    options.private_ip = true
  }

  if (commander.private_ip) {
    options.private_ip = true
  }

  options.port = options.port ? options.port : 22
  options.user = options.user ? options.user : 'root'

  if (ssh_config.options && ssh_config.options.length) {
    options.extra_options = ssh_config.options
  }

  if (alias && alias.options) {
    options.extra_options = alias.options
  }

  return options
}

// Commands

if (commander.list_accounts) {
  config.credentials.forEach(function (account) {
    console.log('%s %s (%s)' + (account.public_token ? ' - %s' : ''), account.name.green, account.type.blue, colors.yellow(account.regions ? account.regions : require('./plugins/' + account.type).regions), account.public_token ? colors.red(account.public_token) : '')
  })
  return
}

if (commander.keys) {
  try {
    console.log("Keys for %s: %s".white, colors.blue(commander.keys), require('./plugins/' + commander.keys).keys.join(", "))
  } catch (error) {
    console.error('Provided type \'%s\' does not exist'.red, commander.keys)
  }
  return
}

parse_arguments()