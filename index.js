#!/usr/bin/env node

var util = require('./util')
var colors = require('colors')
var commander = require('commander')
var parser = require('./query_parser')
var pjson = require('./package.json')
var config = util.load_config()
if (config == null) {
  return
}

var list = function (val) {
  return val.split(',')
}

commander
  .version(pjson.version)
  .option('-r, --region <region>', 'Aws region', list)
  .option('-a --account <account>', 'Account name', list)
  .option('-t --type <type>', 'Type of account', list)
  .option('-l --list_accounts', 'List accounts')
  .option('-f --force_regions', 'Use specified region for all accounts regardless of configured regions')
  .option('-e --enable_filters <filter>', 'Enable specific filter(s)', list)
  .option('-q --query <query>', 'Query')
  .option('-n --name <name>', 'Search by name', list)
  .option('-H --hostname <hostname>', 'Search by hostname', list)
  .option('-i --image <image>', 'Search by image', list)
  .option('-I --ip <ip>', 'Search by ip', list)
  .option('--id <id>', 'Search by id', list)
  .option('-k --keys <type>', 'List searchable keys for a cloud provider', list)
  .option('-u --user <user>', 'SSH user')
  .option('-p --port <port>', 'SSH port')
  .option('-c --ssh_command <ssh_command>', 'Command to execute')
  .option('-A --run_on_all', 'Execute on all found hosts')
  .parse(process.argv)

var force_regions = commander.force_regions || config.force_regions

var alias = false

if (commander.args.length > 0) {
  if (config.alias[commander.args.join(' ')] != null) {
    alias = config.alias[commander.args.join(' ')]
  }
}

var find_servers = function (account, callback) {
  require('./plugins/' + account.type).search(account, function (servers) {
    callback(servers)
  })
}

var starts_with = function (str, match) {
  return str.indexOf(match) == 0
}

var display_results = function (result) {
  var index = 0
  result.forEach(function (server) {
    require('./plugins/' + server.account.type).display(server, index+++1)
  })
  if (result.length == 1 && config.auto_connect_on_one_result) {
    prepare_ssh(result[0])
  } else if (((alias && alias.run_on_all) || commander.run_on_all) && (alias.command || commander.ssh_command)) {
    var color_list = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']
    var color_index = 0
    result.forEach(function (server) {
      prepare_ssh(server, color_list[color_index++])
      if (color_index > (color_list.length - 1)) {
        color_index = 0
      }
    })
  } else {
    var readline = require('readline')
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    rl.question("Which server do you want to connect to? ", function (index) {
      rl.close()
      var server = result[index - 1]
      if (server == null) {
        return console.log('Invalid selection'.red)
      }
      prepare_ssh(result[index - 1])
    })
  }
}

var gather_servers = function (accounts, regions, filters) {
  var todo = []
  if (regions == null || regions.length < 1) {
    regions = []
    accounts.forEach(function (account) {
      if (account.regions == null) {
        account.regions = require('./plugins/' + account.type).regions
      }
      account.regions.forEach(function (region) {
        if (!(regions.indexOf(region) > -1)) {
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
      if (account.regions == null) {
        account.regions = require('./plugins/' + account.type).regions
      }
      account.regions = account.regions.filter(function (region) {
        return regions.indexOf(region) > -1
      })
    }
    if (account.regions.length > 0) {
      todo.push(account)
      console.log('Using %s account %s (%s)' + (account.publicToken ? ' - %s' : '').green, colors.blue(account.type), colors.green(account.name), colors.yellow(account.regions), account.publicToken ? colors.red(account.publicToken) : '')
    }
  })

  if (todo.length == 0) {
    return console.log('No accounts with correct regions found'.red)
  }

  var result = []
  var todo_count = todo.length
  todo.forEach(function (account) {
    find_servers(account, function callback (servers) {
      result = result.concat(servers)
      todo_count--
      if (todo_count == 0) {
        if (result.length == 0) {
          return console.log('No matching servers found'.red)
        }

        if (commander.query || commander.region || commander.name || commander.hostname || commander.image || commander.ip || commander.id || alias || (filters != null && filters.length > 0)) {
          try {
            var query = parser.generate_query_ast_sync(build_query(filters))
          } catch (err) {
            console.log('Invalid query: %s'.red, err.message)
            return
          }

          var result_count = result.length
          var new_result = []
          result.forEach(function (server) {
            // Todo Come up with a better way to clone/disregard account than cloning object using json
            parser.match(JSON.parse(JSON.stringify(server)), query, function (error, matches) {
              if (error) {
                console.log('Error parsing %s'.red, error)
                return
              }
              if (matches) {
                new_result.push(server)
              }
              result_count--
              if (result_count == 0) {
                if (new_result.length == 0) {
                  return console.log('No matching servers found'.red)
                }
                display_results(new_result)
              }
            })
          })
          return
        }
        display_results(result)
      }
    })
  })
}

var build_query = function (filters) {
  var query = ''

  if (commander.name) {
    query += build_query_part('name', commander.name, true)
  }

  if (commander.region) {
    query += build_query_part('region', commander.region, true)
  }

  if (commander.hostname) {
    query += build_query_part('hostname', commander.hostname, true)
  }

  if (commander.image) {
    query += build_query_part('image', commander.image, true)
  }

  if (commander.ip) {
    query += build_query_part('ip', commander.ip, true)
  }

  if (commander.id) {
    query += build_query_part('id', commander.id, true)
  }

  if (filters) {
    query += ' AND (' + filters + ')'
  }

  if (commander.query) {
    if (query.length == 0) {
      query += commander.query
    } else {
      query += ' AND (' + commander.query + ')'
    }
  }

  if (alias && alias.query) {
    query += ' AND (' + alias.query + ')'
  }

  query = query.trim()
  if (starts_with(query, 'AND')) {
    query = query.substring(3)
  }
  if (starts_with(query, 'OR')) {
    query = query.substring(2)
  }

  console.log(query)

  return query.trim()
}

var build_query_part = function (key_name, key, with_contains) {
  var query = ' AND ('
  var split_count = key.length
  key.forEach(function (split) {
    split_count--
    query += key_name + ' ' + (with_contains ? 'CONTAINS' : '=') + ' \'' + split + '\''
    if (split_count != 0) {
      query += ' OR '
    }
  })
  query += ')'
  return query
}

var setup_filters = function (accounts, regions) {
  var filters = ''
  if (commander.enable_filters || (config.enabled_filters != null && config.enabled_filters.length > 0)) {
    already_gathered = true
    var filter_list = []
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
    if (config.enabled_filters != null && config.enabled_filters.length > 0) {
      filter_list = filter_list.concat(config.enabled_filters)
    }
    filter_list = util.deduplicate_array(filter_list)
    var filter_count = filter_list.length
    filter_list.forEach(function (filter) {
      require('./plugins/' + filter.toLowerCase()).filter(config, function (the_filters) {
        filters += the_filters
        filter_count--
        if (filter_count == 0) {
          gather_servers(accounts, regions, filters.trim())  
        }
      })
    })
  } else {
    gather_servers(accounts, regions, filters.trim())
  }
}

var defined_accounts = function (account) {
  if (config.plugins.indexOf(account.type) > -1) {
    return true
  } else {
    console.log('Unknown type %s - ignoring account %s'.red, account.type, account.name)
    return false
  }
}

var parse_arguments = function () {
  var regions = []
  var accounts = []
  if (commander.region) {
    regions = commander.region
  }
  if (commander.account || (alias && alias.accounts)) {
    var found = false
    accounts = config.credentials.filter(function (account) {
      return util.contains_with_lowercase(account.name.toLowerCase(), commander.account ? commander.account : alias.accounts) || (account.publicToken != null && util.contains_with_lowercase(account.publicToken.toLowerCase(), commander.account ? commander.account : alias.accounts))
    })
    accounts = accounts.filter(defined_accounts)
    if (accounts.length < 1) {
      return console.log('No accounts found with this name or public token'.red)
    }
  } else {
    if (config.credentials == null || config.credentials.length < 1) {
      return console.log('No accounts defined in config'.red)
    }
    accounts = config.credentials.filter(defined_accounts)
  }
  if (commander.type) {
    var valid_types = []
    commander.type.forEach(function (type) {
      if (!(config.plugins.indexOf(type.toLowerCase()) > -1)) {
        console.log('Ignoring invalid type %s, valid types: [%s]'.red, type, config.plugins)
      } else {
        valid_types.push(type.toLowerCase())
      }
    })
    accounts = accounts.filter(function (account) {
      return util.contains(account.type.toLowerCase(), valid_types)
    })
  }
  if (accounts.length == 0) {
    return console.log('No valid accounts found'.red)
  }
  setup_filters(accounts, regions)
}

//Todo ssh options, keypair, etc 
var prepare_ssh = function (server, disable_tt) {
  if (config.ssh_config.length < 1) {
    return console.log('Please specify a default ssh config'.red)
  }
  var ssh_config
  var config_count = config.ssh_config.length
  config.ssh_config.forEach(function (the_config) {
    if (the_config.priority == 0) {
      config_count--
      if (ssh_config == null) {
        ssh_config = the_config
      }
      if (config_count == 0) {
        ssh(server, ssh_config, disable_tt)
      }
    } else {
      var account_match = false
      if (the_config.accounts && (util.contains_with_lowercase(server.account.name.toLowerCase(), the_config.accounts) || (server.account.publicToken != null && util.contains_with_lowercase(server.account.publicToken.toLowerCase(), the_config.accounts)))) {
        account_match = true
      }
      if (the_config.query && the_config.query != '*') {
        try {
          var query = parser.generate_query_ast_sync(the_config.query)
        } catch (err) {
          console.log('Invalid ssh config query: %s'.red, err.message)
          return
        }

        parser.match(JSON.parse(JSON.stringify(server)), query, function (error, matches) {
          if (error) {
            console.log('Error parsing with ssh config query %s'.red, error)
            return
          }
          if (matches) {
            if ((the_config.accounts && account_match) || !the_config.accounts) {
              if (ssh_config == null || the_config.priority > ssh_config.priority) {
                ssh_config = the_config
              }
            }
          }
          config_count--
          if (config_count == 0) {
            ssh(server, ssh_config, disable_tt)
          }
        })
      } else {
        if (account_match) {
          if (ssh_config == null || the_config.priority > ssh_config.priority) {
            ssh_config = the_config
          }
        }
        config_count--
        if (config_count == 0) {
          ssh(server, ssh_config, disable_tt)
        }
      }
    }
  })
}


var ssh = function (server, ssh_config, disable_tt) {
    // Todo Merge default conf with ssh config, config option?
    if (ssh_config) {
      if (commander.port) {
        ssh_config.port = commander.port
      }
      if (commander.user) {
        ssh_config.user = commander.user
      }
      if (alias && alias.command) {
        ssh_config.command = alias.command
      }
      if (commander.ssh_command) {
        ssh_config.command = commander.ssh_command
      }
      ssh_config.port = ssh_config.port ? ssh_config.port : 22
      ssh_config.user = ssh_config.user ? ssh_config.user : 'root'
      require('./plugins/' + server.account.type).ssh(server, ssh_config.user, ssh_config.port, ssh_config.keyfile, (ssh_config.options != null && ssh_config.options.length > 0) ? ssh_config.options : [], ssh_config.command, disable_tt)
    } else {
      return console.log('No matching ssh config, please specify a default ssh config'.red)
    }
}

if (commander.list_accounts) {
  config.credentials.forEach(function (account) {
    console.log('%s %s (%s)' + (account.publicToken ? ' - %s' : ''), account.name.green, account.type.blue, colors.yellow(account.regions), account.publicToken ? colors.red(account.publicToken) : '')
  })
  return
}

if (commander.keys) {
  commander.keys.forEach(function (key) {
    try {
      console.log("Keys for %s: %s".white, colors.blue(key), require('./plugins/' + key).keys.join(", "))
    } catch (err) {
      console.error('Provided plugin \'%s\' does not exist'.red, key)
    }
  })
  return
}

parse_arguments()