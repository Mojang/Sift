module.exports = function (options, alias) {
  var util = require('./util')
  var colors = require('colors')
  var parser = require('./query_parser')
  var async = require('async')
  var readline = require('readline')
  var path = require('path')
  var fs = require('fs')

  var Sift = {}

  Sift.util = util

  Sift.gather_servers = function (accounts, regions, filters, callback) {
    if (options.ansible && typeof callback !== 'function') {
      callback = function (callback) {}
    }

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
      if ((options.force_regions && options.region) || (alias && alias.regions)) {
        account.regions = options.region ? options.region : alias.regions
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
      if (error) {
        // TODO error handling
      }

      if (!servers.length) {
        return console.log('No matching servers found'.red)
      }

      filter_results(filters, servers, callback)
    })
  }

  var filter_results = function (filters, servers, callback) {
    if (options.query || options.region || options.servername || options.hostname || options.image || options.ip || options.id || alias || (filters && filters.length)) {
      try {
        var query = parser.generate_query_ast_sync(build_query(filters))
      } catch (error) {
        console.log('Invalid query: %s'.red, error.message)
        return callback({ code: 1 })
      }

      async.concat(servers, function (server, next) {
        parser.match(JSON.parse(JSON.stringify(server)), query, function (error, matches) {
          next(error, matches ? server : [])
        })
      }, function (error, servers) {
        if (error) {
          // TODO error handling
        }

        if (!servers.length) {
          console.log('No matching servers found'.red)
          return callback({ code: 1 })
        }

        display_results(servers, callback)
      })
    } else {
      display_results(servers, callback)
    }
  }

  var build_query = function (filters) {
    var query = ''

    if (options.servername) {
      query += build_query_part('name', options.servername)
    }

    if (options.region) {
      query += build_query_part('region', options.region)
    }

    if (options.hostname) {
      query += build_query_part('hostname', options.hostname)
    }

    if (options.image) {
      query += build_query_part('image', options.image)
    }

    if (options.ip) {
      query += build_query_part('ip', options.ip)
    }

    if (options.id) {
      query += build_query_part('id', options.id)
    }

    if (filters) {
      query += ' AND (' + filters + ')'
    }

    if (options.query) {
      if (!query.length) {
        query += options.query
      } else {
        query += ' AND (' + options.query + ')'
      }
    }

    // TODO remove references of alias
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

  var display_results = function (result, callback) {
    var color_index = 0
    var index = 0

    result.forEach(function (server) {
      require('./plugins/' + server.account.type).display(server, index++ + 1)
    })

    if (result.length === 1 && options.auto_connect_on_one_result) {
      return prepare_ssh(result[0], function (ssh_config) {
        if (options.ansible) {
          ansible([{ server: result[0], ssh_config: ssh_config }], callback)
        } else {
          ssh(result[0], ssh_config)
        }
      })
    }

    if ((((alias && alias.run_on_all) || options.run_on_all) && ((alias && alias.command) || options.ssh_command)) || (options.ansible && options.run_on_all)) {
      return async.mapSeries(result, function (server, next) {
        prepare_ssh(server, function (ssh_config) {
          var color = util.colors[color_index++]

          if (color_index > (util.colors.length - 1)) {
            color_index = 0
          }

          next(null, { server: server, ssh_config: ssh_config, disable_tt: color })
        })
      }, function (error, ssh_results) {
        if (error) {
          // TODO error handling
        }

        if (options.ansible) {
          ansible(ssh_results, callback)
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

    reader.question('Which server do you want to connect to? ', function (index) {
      var server = result[index - 1]
      reader.close()

      if (!server) {
        return console.log('Invalid selection'.red)
      }

      prepare_ssh(server, function (ssh_config) {
        if (options.ansible) {
          ansible([{ server: server, ssh_config: ssh_config }], callback)
        } else {
          ssh(server, ssh_config)
        }
      })
    })
  }

  var prepare_ssh = function (server, callback) {
    var ssh_config

    if (!options.ssh_config.length) {
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
      if (error) {
        // TODO error handling
      }

      callback(ssh_config)
    }

    async.each(options.ssh_config, iterate_configs, next)
  }

  var build_ssh_config = function (ssh_config, disable_tt) {
    var ssh_options = {
      user: ssh_config.user,
      port: ssh_config.port,
      keyfile: ssh_config.keyfile,
      command: ssh_config.command,
      disable_tt: disable_tt,
      private_ip: ssh_config.private_ip,
      public_ip: ssh_config.public_ip,
      extra_options: []
    }

    if (alias && alias.user) {
      ssh_options.user = alias.user
    }

    if (options.user) {
      ssh_options.user = options.user
    }

    if (alias && alias.port) {
      ssh_options.port = alias.port
    }

    if (options.port) {
      ssh_options.port = options.port
    }

    if (alias && alias.keyfile) {
      ssh_options.keyfile = alias.keyfile
    }

    if (options.keyfile) {
      ssh_options.keyfile = options.keyfile
    }

    if (alias && alias.command) {
      ssh_options.command = alias.command
    }

    if (options.ssh_command) {
      ssh_options.command = options.ssh_command
    }

    if (alias && alias.private_ip) {
      ssh_options.private_ip = true
    }

    if (alias && alias.public_ip) {
      ssh_options.public_ip = true
    }

    if (options.private_ip) {
      ssh_options.private_ip = true
    }

    if (options.public_ip) {
      ssh_options.public_ip = true
    }

    ssh_options.port = ssh_options.port ? ssh_options.port : 22
    ssh_options.user = ssh_options.user ? ssh_options.user : 'root'

    if (ssh_config.options && ssh_config.options.length) {
      ssh_options.extra_options = ssh_config.options
    }

    if (alias && alias.options) {
      ssh_options.extra_options = alias.options
    }

    return ssh_options
  }

  var ssh = function (server, ssh_config, disable_tt) {
    // TODO Merge default conf with ssh config, config option?
    if (ssh_config) {
      return require('./plugins/' + server.account.type).ssh(server, build_ssh_config(ssh_config, disable_tt))
    }

    console.log('No matching ssh config, please specify a default ssh config'.red)
  }

  var ansible = function (servers, callback) {
    var inventory_file = path.resolve(options.ansible_dir, (new Date()).valueOf().toString() + '.sh')

    var ansible_inventory = {
      all: {
        hosts: [],
        vars: {
          ansible_connection: 'ssh'
        }
      },
      _meta: {
        hostvars: {}
      }
    }

    servers.forEach(function (server) {
      server.ssh_config = build_ssh_config(server.ssh_config)
      var hostname = (server.ssh_config.private_ip ? server.server['private-ip'] : (server.ssh_config.public_ip ? server.server.ip : server.server.hostname))
      var region = server.server.region.replace(/-/g, '_')

      ansible_inventory.all.hosts.push(hostname)

      var ansible_options = {
        ansible_ssh_user: server.ssh_config.user
      }

      if (server.ssh_config.port) {
        ansible_options.ansible_ssh_port = server.ssh_config.port
      }

      if (server.ssh_config.keyfile) {
        ansible_options.ansible_ssh_private_key_file = server.ssh_config.keyfile
      }

      ansible_options.ansible_instance_region = region

      ansible_inventory._meta.hostvars[hostname] = ansible_options
    })

    if (!fs.existsSync(options.ansible_dir)) {
      fs.mkdirSync(options.ansible_dir)
    }


    fs.writeFileSync(inventory_file, '#!/bin/sh\necho \'' + JSON.stringify(ansible_inventory) + '\'', 'utf8')
    fs.chmodSync(inventory_file, '0755')

    var ansible_args = []
    ansible_args.push(options.ansible, '-i', inventory_file)

    if (options.ansible_extra_args) {
      ansible_args.push('-e', options.ansible_extra_args)
    }
    
    if (options.verbose) {
      ansible_args.push('-vvvv')
      console.log('Running \'ansible-playbook ' + ansible_args.join(' ') + '\'')
    }  

    var child = require('child_process').spawn('ansible-playbook', ansible_args, { stdio: 'inherit' })
    child.on('exit', function (code, signal) {
      fs.unlink(inventory_file, function (error) {
        if (error) {
          console.log('Error removing ansible inventory: %s', inventory_file)
        }

        callback({ code: code, signal: signal })
      })
    })
  }

  return Sift
}
