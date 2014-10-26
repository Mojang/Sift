var nautical = require('nautical')
var util = require('../util')
var digitalocean = module.exports = {

  search: function (account, callback) {
    var results = []
    var client = nautical.getClient({ token: account.token })
    var params = {}
    var get_servers = function (page, done) {
      client.droplets.list({ page: page }, function (err, reply) {
        if (err) {
          console.log('Something went wrong when searching DigitalOcean: %s'.red, err)
          return done(err)
        }

        reply.body.droplets.forEach(function (server) {
          results.push({
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

        if ('function' === typeof reply.next) {
          return get_servers(page+=1, done)
        }

        return done()
      })
    }

    get_servers(1, function (error) {
      return callback(results)
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