var nautical = require('nautical')
var util = require('../util')
var per_page = 25
var digitalocean = module.exports = {

  search: function (account, callback) {
    var result = []
    var client = nautical.getClient({ token: account.token })
    client.droplets.list({ per_page: per_page }, function (err, reply) {
      if (err) {
        console.log('Something went wrong when searching DigitalOcean: %s'.red, err)
        return callback(result)
      }
      result = add_to_results(account, result, reply.body.droplets)
      if (reply.body.meta && reply.body.meta.total && reply.body.meta.total > per_page) {
        var pages = Math.floor(reply.body.meta.total / per_page) - 1
        var todo = pages
        for (var i = 0; i < pages; i++) {
          client.droplets.list({ page: (i+2), per_page: per_page }, function (err, reply) {
            if (err) {
              console.log('Something went wrong when searching DigitalOcean: %s'.red, err)
            } else {
              result = add_to_results(account, result, reply.body.droplets) 
            }
            todo--
            if (todo == 0) {
              callback(result)
            }
          })
        }
      } else {
        callback(result)
      }
    })
  },

  ssh: function (server, user, port, keyfile, options, command, disable_tt) {
    util.ssh(server, user, port, keyfile, options, command, disable_tt)
  },

  display: function (server, index) {
    util.display(server, index)
  },

  regions: ['nyc1', 'ams1', 'sfo1', 'nyc2', 'ams2', 'sgp1', 'lon1', 'nyc3', 'ams3'],

  keys: util.keys
}

var add_to_results = function (account, result, results_to_add) {
  results_to_add.forEach(function (server) {
    result.push({
      'id': server.id,
      'name': server.name,
      'region': server.region.slug,
      'hostname': server.networks.v4[0].ip_address,
      'account': account,
      'image': server.image.id,
      'ip': server.networks.v4[0].ip_address,
      'type': server.size_slug
    })
  })
  return result
}