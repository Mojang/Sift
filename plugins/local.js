var util = require('../util')
module.exports = {

  search: function (account, callback) {
    var result = []

    if (!account.local_files || account.local_files.length < 1 || !(account.local_files instanceof Array)) {
      return console.log('Please define a list of local files as local_files for the account.'.red)
    }

    account.local_files.forEach(function (file) {
      var data

      try {
        data = require(file)
      } catch (e) {
        return console.log('Error reading %s, invalid syntax?'.red, file)
      }

      data.forEach(function (server) {
        var result_server = { account: account }

        Object.keys(server).forEach(function (key) {
          if (!result_server[key]) {
            result_server[key] = server[key]
          }
        })

        if (!result_server.id || !result_server.name || !result_server.hostname) {
          console.log('Skipping server %s because id/name/hostname is missing!'.red, JSON.stringify(server))
        } else {
          result.push(result_server)
        }
      })
    })
    callback(result)
  },

  ssh: function (server, options) {
    util.ssh(server, options)
  },

  display: function (server, index) {
    util.display(server, index)
  },

  regions: ['Local'],

  keys: ['id', 'name', 'hostname', 'Whatever you specify']
}
