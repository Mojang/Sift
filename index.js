#!/usr/bin/env node
var util = require('./util')
var colors = require('colors')
var commander = require('commander')
var parser = require('./query_parser')
var pjson = require('./package.json')
var config = util.loadConfig()
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
.option('-u --user <user>', 'SSH user')
.option('-p --port <port>', 'SSH port')
.parse(process.argv)

var force_regions = commander.force_regions || config.force_regions

var alias = false

if (commander.args.length > 0) {
  if (config.alias[commander.args.join(' ')] != null) {
    alias = config.alias[commander.args.join(' ')] 
  }
}

var findServers = function (account, callback) {
  require('./plugins/' + account.type).search(account, function (servers) {
    callback(servers)
  })
}

var startsWith = function (str, match) {
    return str.indexOf(match) == 0;
}

/* filter */
/*
   var element;
            filterName.forEach(function (specificFilterName) {
              if (element == null) {
                element = server[specificFilterName]
              } else {
                element = element[specificFilterName]
              }
            })
*/

var displayResults = function (result) {
  var index = 0;
  result.forEach(function (server) {
    require('./plugins/' + server.account.type).display(server, index++ + 1)
  })
  var readline = require('readline')
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  rl.question("Which server do you want to connect to? ", function (index) {
    rl.close();
    var server = result[index-1]
    if (server == null) {
      return console.log('Invalid selection'.red)
    }
    connectToSSH(result[index-1])
  })
}

var gatherServers = function (accounts, regions, filters) {
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
      account.regions = account.regions.filter(function filterRegions (region) {
        return require('./plugins/' + account.type).regions.indexOf(region) > -1
      })
    } else {
      if (account.regions == null) {
        account.regions = require('./plugins/' + account.type).regions
      }
      account.regions = account.regions.filter(function filterRegions(region) {
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

  var result = [];
  var todoCount = todo.length;
  todo.forEach(function (account) {
    findServers(account, function callback(servers) {
      result = result.concat(servers)
      todoCount--
      if (todoCount == 0) {
        if (result.length == 0) {
          return console.log('No matching servers found'.red)
        }

        if (commander.query || commander.region || commander.name || commander.hostname || commander.image || commander.ip || commander.id || alias || (filters != null && filters.length > 0)) {
          var query;
          var buildQuery = ''
         
          if (commander.region) {
            buildQuery += ' AND ('
            var regionSplitCount = commander.region.length
            commander.region.forEach(function (regionSplit) {
              regionSplitCount--
              buildQuery += 'region = ' + regionSplit
              if (regionSplitCount != 0) {
                buildQuery += ' OR '
              }
            })
            buildQuery += ')'
          }
         
          if (commander.name) {
            buildQuery += ' AND ('
            var nameSplitCount = commander.name.length
            commander.name.forEach(function (nameSplit) {
              if (nameSplit.split(" ").length > 1) {
                buildQuery += '('
                var nameSplitSplitCount = nameSplit.split(" ").length
                nameSplit.split(" ").forEach(function (nameSplitSplit) {
                  buildQuery += 'name CONTAINS ' + nameSplitSplit
                  nameSplitSplitCount--
                  if (nameSplitSplitCount != 0) {
                    buildQuery += ' AND '
                  }
                })
                buildQuery += ')'
              } else {
                buildQuery += 'name CONTAINS ' + nameSplit
              }
              nameSplitCount--
              if (nameSplitCount != 0) {
                buildQuery += ' OR '
              }
            })
            buildQuery += ')'
          }
         
          if (commander.hostname) {
            buildQuery += ' AND ('
            var hostNameSplitCount = commander.hostname.length
            commander.hostname.forEach(function (hostnameSplit) {
              hostNameSplitCount--
              buildQuery += 'hostname = ' + hostnameSplit
              if (hostNameSplitCount != 0) {
                buildQuery += ' OR '
              }
            })
            buildQuery += ')'
          }
         
          if (commander.image) {
            buildQuery += ' AND ('
            var imageSplitCount = commander.image.length
            commander.image.forEach(function (imageSplit) {
              imageSplitCount--
              buildQuery += 'image = ' + imageSplit
              if (imageSplitCount != 0) {
                buildQuery += ' OR '
              }
            })
            buildQuery += ')'    
          }
    
          if (commander.ip) {
            buildQuery += ' AND ('
            var ipSplitCount = commander.ip.length
            commander.ip.forEach(function (ipSplit) {
              ipSplitCount--
              buildQuery += 'ip = ' + ipSplit
              if (ipSplitCount != 0) {
                buildQuery += ' OR '
              }
            })
            buildQuery += ')'          
          }
          
          if (commander.id) {
            buildQuery += ' AND ('
            var idSplitcount = commander.id.length
            commander.id.forEach(function (idSplit) {
              idSplitcount--
              buildQuery += 'id = ' + idSplit
              if (idSplitcount != 0) {
                buildQuery += ' OR '
              }
            })
            buildQuery += ')'
          }
          
          if (filters) {
            buildQuery += ' AND (' + filters + ')'
          }
          
          if (commander.query) {
            if (buildQuery.length == 0) {
              buildQuery += commander.query
            } else {
              buildQuery += ' AND (' + commander.query + ')'
            }
          }

          if (alias && alias.query) {
            buildQuery += ' AND (' + alias.query + ')'
          }

          buildQuery = buildQuery.trim()
          if (startsWith(buildQuery, 'AND')) {
            buildQuery = buildQuery.substring(3)
          }
          if (startsWith(buildQuery, 'OR')) {
            buildQuery = buildQuery.substring(2)
          }
          console.log(buildQuery.trim())
          try {
            query = parser.generate_query_ast_sync(buildQuery.trim())
          } catch (err) {
            console.log('Invalid query: %s'.red, err.message)
            return
          }

          var resultCount = result.length;
          var newResult = []
          result.forEach(function (server) {
            // Todo Come up with a better way to clone/disregard account than cloning object using json
            parser.match(JSON.parse(JSON.stringify(server)), query, function (error, matches) {
              if (error) {
                console.log('Error parsing %s'.red, error)
                return
              }
              if (matches) {
                newResult.push(server)
              }
              resultCount--
              if (resultCount == 0) {
                if (newResult.length == 0) {
                  return console.log('No matching servers found'.red)
                }
                displayResults(newResult)
              }
            })
          })
          return
        }
        displayResults(result)
      }
    })
  })
}

var setupFilters = function (accounts, regions) {
  var filters = ''
  var alreadyGathered = false;
  if (config.enabled_filters != null && config.enabled_filters.length > 0) {
    alreadyGathered = true
    var enabledFilterCount = config.enabled_filters.length
    config.enabled_filters.forEach(function (filter) {
      require('./plugins/' + filter).filter(config, function (the_filters) {
        filters += the_filters
        enabledFilterCount--
        if (enabledFilterCount == 0) {
          gatherServers(accounts, regions, filters.trim())
        }
      })
    })
  }
  if (commander.enable_filters && !alreadyGathered) {
    alreadyGathered = true
    commander.enable_filters.forEach(function (filter) {
      if (config.allowed_filters.indexOf(filter.toLowerCase()) > -1) {
        require('./plugins/' + filter.toLowerCase()).filter(config, function (the_filters) {
          filters += the_filters
          gatherServers(accounts, regions, filters.trim())
        })
      } else {
        console.log('Ignoring invalid filter %s'.red, filter)
      }
    })
  }
  if (!alreadyGathered) {
    gatherServers(accounts, regions, filters.trim())
  }
}

var parseArguments = function () {
  var regions = []
  var accounts = []
  if (commander.region) {
    regions = commander.region
  }
  if (commander.account || (alias && alias.accounts)) {
    var found = false
    accounts = config.credentials.filter(function (account) {
      return util.containsWithLowercase(account.name.toLowerCase(), commander.account ? commander.account : alias.accounts) || (account.publicToken != null && util.containsWithLowercase(account.publicToken.toLowerCase(), commander.account ? commander.account : alias.accounts))
    })
    accounts = accounts.filter(function (account) {
      if (config.plugins.indexOf(account.type) > -1) {
        return true
      } else {
        console.log('Unknown type %s - ignoring account %s'.red, account.type, account.name)
        return false
      }
    })
    if (accounts.length < 1) {
      return console.log('No accounts found with this name or public token'.red)
    }
  } else {
    if (config.credentials == null || config.credentials.length < 1) {
      return console.log('No accounts defined in config'.red)
    }
    accounts = config.credentials.filter(function (account) {
      if (config.plugins.indexOf(account.type) > -1) {
        return true
      } else {
        console.log('Unknown type %s - ignoring account %s'.red, account.type, account.name)
        return false
      }
    })
  }
  if (commander.type) {
    var validTypes = []
    commander.type.forEach(function (type) {
      if (!(config.plugins.indexOf(type.toLowerCase()) > -1)) {
        console.log('Ignoring invalid type %s, valid types: [%s]'.red, type, config.plugins)
      } else {
        validTypes.push(type.toLowerCase())
      }
    })
    accounts = accounts.filter(function (account) {
      return util.contains(account.type.toLowerCase(), validTypes)
    })
  }
  if (accounts.length == 0) {
    return console.log('No valid accounts found'.red)
  }
  setupFilters(accounts, regions)
}

//Todo ssh options, keypair, etc 
var connectToSSH = function (server) {
  if (config.ssh_config.length < 1) {
    return console.log('Please specify a default ssh config'.red)
  }
  var sshConf;
  var configCount = config.ssh_config.length
  config.ssh_config.forEach(function (the_config) {
    if (the_config.priority == 0) {
      configCount--
      if (sshConf == null) {
        sshConf = the_config
      }
      if (configCount == 0) {
        doSSH(server, sshConf)
      }
    } else {
      var accountMatch = false
      if (the_config.accounts && (util.containsWithLowercase(server.account.name.toLowerCase(), the_config.accounts) || (server.account.publicToken != null && util.containsWithLowercase(server.account.publicToken.toLowerCase(), the_config.accounts)))) {
        accountMatch = true
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
            console.log('Error parsing %s'.red, error)
            return
          }
          configCount--
          if (matches) {
            if ((the_config.accounts && accountMatch) || !the_config.accounts) {
              if (sshConf == null || the_config.priority > sshConf.priority) {
                sshConf = the_config
              }
            }
          }
          if (configCount == 0) {
            doSSH(server, sshConf)
          }
        })
      } else {
        configCount--
        if (accountMatch) {
          if (sshConf == null || the_config.priority > sshConf.priority) {
            sshConf = the_config
          }        
        }
        if (configCount == 0) {
          doSSH(server, sshConf)
        }
      }
    }
  })
}


var doSSH = function (server, sshConf) {
    // Todo Merge default conf with ssh config?
  if (sshConf) {
    if (commander.port) {
      sshConf.port = commander.port
    }
    if (commander.user) {
      sshConf.user = commander.user
    }
    require('./plugins/' + server.account.type).ssh(server, sshConf.user, sshConf.port, sshConf.keyfile, (sshConf.options != null && sshConf.options.length > 0) ? sshConf.options : [])
  } else {
    return console.log('No matching ssh config, please specify a default ssh config'.red)
  }
}
//console.log(commander.args[0])

// Possibly read from shared credential store by AWS? http://blogs.aws.amazon.com/security/post/Tx3D6U6WSFGOK2H/A-New-and-Standardized-Way-to-Manage-Credentials-in-the-AWS-SDKs

if (commander.list_accounts) {
  config.credentials.forEach(function (account) {
    console.log('%s %s (%s)' + (account.publicToken ? ' - %s' : ''), account.name.green, account.type.blue, colors.yellow(account.regions), account.publicToken ? colors.red(account.publicToken) : '')
  })
  return
}

parseArguments()