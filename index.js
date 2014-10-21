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

commander
.version(pjson.version)
.option('-r, --region <region>', 'Aws region')
.option('-a --account <account>', 'Account name')
.option('-t --type <type>', 'Type of account')
.option('-l --list_accounts', 'List accounts')
.option('-f --force_regions', 'Use specified region for all accounts regardless of configured regions')
.option('-e --enable_filter <filter>', 'Enable specific filter')
.option('-q --query <query>', 'Query')
.parse(process.argv)

var force_regions = commander.force_regions || config.force_regions

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
    if (force_regions && commander.region) {
      account.regions = [commander.region]
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

        if (commander.query || commander.region || (filters != null && filters.length > 0)) {
          var query;
          var buildQuery = ''
          if (commander.query) {
            buildQuery += commander.query
          }
          if (commander.region) {
            buildQuery += ' region = ' + commander.region
          }
          if (filters) {
            buildQuery += ' ' + filters
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
  if (commander.enable_filter && !alreadyGathered) {
    alreadyGathered = true
    if (config.allowed_filters.indexOf(commander.enable_filter.toLowerCase()) > -1) {
      require('./plugins/' + commander.enable_filter.toLowerCase()).filter(config, function (the_filters) {
        filters += the_filters
        gatherServers(accounts, regions, filters.trim())
      })
    } else {
      console.log('Ignoring invalid filter %s'.red, commander.enable_filter)
    }
  }
  if (!alreadyGathered) {
    gatherServers(accounts, regions, filters.trim())
  }
}

var parseArguments = function () {
  var regions = []
  var accounts = []
  if (commander.region) {
    regions = [commander.region]
  }
  if (commander.account) {
    var found = false
    accounts = config.credentials.filter(function (account) {
      return account.name.toLowerCase() == commander.account.toLowerCase() || (account.publicToken != null && account.publicToken.toLowerCase() == commander.account.toLowerCase())
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
    if (!(config.plugins.indexOf(commander.type) > -1)) {
      return console.log('Please specify a valid type [%s]'.red, config.plugins)
    }
    accounts = accounts.filter(function (account) {
      return account.type == commander.type.toLowerCase()
    })
  }
  if (accounts.length == 0) {
    return console.log('No valid accounts found'.red)
  }
  setupFilters(accounts, regions)
}

//Todo ssh options, keypair, etc 
var connectToSSH = function (server) {
  require('./plugins/' + server.account.type).ssh(server, 'root', null, null, {})
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