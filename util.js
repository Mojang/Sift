var path = require('path')
var colors = require('colors')
var fs = require('fs')
var config

var typesMatch = function (a, b) {
  return (typeof a === typeof b) && (Array.isArray(a) === Array.isArray(b))
}

if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function(suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
}

var util = module.exports = {
  home: process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE,

  load_config: function (config_file) {
    var user_config
    var config_path = config_file ? path.resolve(config_file) : path.resolve(util.home, '.sift.json')
    var the_config = require('./config')
    var final_config = {}

    if (fs.existsSync(config_path)) {
      try {
        if (config_path.endsWith('.json')) {
          user_config = require(config_path)
        } else {
          user_config = JSON.parse(fs.readFileSync(config_path))
        }
      } catch (error) {
        console.log('Could not load user configuration, please correct the syntax of %s in your home directory'.red, config_path)
        return null
      }

      if (JSON.stringify(the_config) === JSON.stringify(user_config)) {
        console.log('Please update the default configuration in %s'.red, config_path)
        return null
      }
    } else {
      fs.writeFileSync(config_path, JSON.stringify(the_config, null, 4), 'utf8')
      console.log('Please update the default configuration in %s'.red, config_path)
      return null
    }

    final_config = util.merge(user_config, the_config)

    var json

    if (final_config.alias_includes && final_config.alias_includes.length) {
      final_config.alias_includes.forEach(function (alias_include) {
        try {
          var alias_file = fs.readFileSync(alias_include, 'utf-8')
          json = JSON.parse(alias_file)
        } catch (error) {
          return console.log('Error reading %s, invalid syntax?'.red, alias_include)
        }

        Object.keys(json).forEach(function (key) {
          if (!final_config.alias[key]) {
            final_config.alias[key] = json[key]
          }
        })
      })
    }

    if (!final_config.ansible_dir) {
      final_config.ansible_dir = path.resolve(util.home, '.sift_ansible')
    }

    config = final_config
    return final_config
  },

  contains: function (match, array) {
    for (var i in array) {
      if (array[i] === match) {
        return true
      }
    }
    return false
  },

  contains_with_lowercase: function (match, array) {
    for (var i in array) {
      if (array[i].toLowerCase() === match) {
        return true
      }
    }
    return false
  },

  ssh: function (server, options) {
    var default_args = [options.user + '@' + (options.private_ip ? server['private-ip'] : server.hostname)]

    if (options.port) {
      default_args.unshift('-p', options.port)
    }

    if (options.keyfile) {
      default_args.unshift('-i', options.keyfile)
    }

    if (!options.disable_tt) {
      default_args.unshift('-tt')
    }

    var ssh_args = (options.extra_options && options.extra_options.length) ? options.extra_options.concat(default_args) : default_args

    if (options.command) {
      ssh_args.push(options.command)
    }

    if (!options.disable_tt) {
      require('child_process').spawn('ssh', ssh_args, { stdio: 'inherit' })
    } else {
      var child = require('child_process').spawn('ssh', ssh_args)

      var output = function (data) {
        console.log(colors[options.disable_tt]('[' + server.id + '] ' + data.toString().replace(/\n$/, '')))
      }

      child.stdout.on('data', output)
      child.stderr.on('data', output)
    }
  },

  display: function (server, index) {
    console.log('(%s) %s - %s' + (server.region ? ' [%s]' : '%s') + ' [%s] [%s] [%s]', (index), colors.green(server.account.name), colors.blue(server.account.type), server.region ? colors.red(server.region) : '', colors.cyan(server.id), colors.green(server.name), colors.yellow(server.hostname))
  },

  deduplicate_array: function (array) {
    return array.filter(function (elem, pos) {
      return array.indexOf(elem) === pos
    })
  },

  starts_with: function (str, match) {
    return str.indexOf(match) === 0
  },

  list: function (val) {
    return val.split(',')
  },

  check_account_type: function (account) {
    if (config.plugins.indexOf(account.type) > -1) {
      return true
    } else {
      console.log('Unknown type %s - ignoring account %s'.red, account.type, account.name)
      return false
    }
  },

  find_servers: function (account, callback) {
    require('./plugins/' + account.type).search(account, function (servers) {
      callback(servers)
    })
  },

  keys: ['id', 'name', 'region', 'hostname', 'account', 'image', 'ip', 'type'],

  colors: ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'],

  // https://github.com/remy/nodemon/blob/master/lib/utils/merge.js
  merge: function (one, two) {
    var result = one

    Object.getOwnPropertyNames(two).forEach(function (key) {
      if (one[key] === undefined) {
        result[key] = two[key]
      }
    })

    Object.getOwnPropertyNames(one).forEach(function (key) {
      var value = one[key]

      if (two[key] && typesMatch(value, two[key])) {
        if (value === '') {
          result[key] = two[key]
        }

        if (Array.isArray(value)) {
          if (value.length === 0 && two[key].length) {
            result[key] = two[key].slice(0)
          }
        } else if (typeof value === 'object') {
          result[key] = util.merge(value, two[key])
        }
      }
    })

    return result
  }
}