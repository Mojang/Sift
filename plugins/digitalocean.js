var nautical = require('nautical')
var util = require('../util')
var digitalocean = module.exports = {

  search: function (account, callback) {
    var results = []
    var client = nautical.getClient({ token: account.token })
    var get_servers = function (page, done) {
      client.droplets.list({ page: page }, function (err, reply) {
        if (err) {
          console.log('Something went wrong when searching DigitalOcean: %s'.red, err)
          return done(err)
        }

        reply.body.droplets.forEach(function (server) {
          var result = {
            'id': server.id,
            'name': server.name,
            'region': server.region.slug,
            'hostname': server.networks.v4[0].ip_address,
            'account': account,
            'image': server.image.id,
            'ip': server.networks.v4[0].ip_address,
            'private-ip': ((server.networks.v4.length > 1) ? server.networks.v4[1].ip_address : server.networks.v4[0].ip_address),
            'type': server.size_slug
          }

          if (server.networks.v6 && server.networks.v6.length) {
            result.ipv6 = server.networks.v6[0].ip_address
          }
          
          results.push(result)
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

  ssh: function (server, options) {
    util.ssh(server, options)
  },

  display: function (server, index) {
    util.display(server, index)
  },

  regions: ['nyc1', 'ams1', 'sfo1', 'nyc2', 'ams2', 'sgp1', 'lon1', 'nyc3', 'ams3'],

  keys: ['id', 'name', 'region', 'hostname', 'account', 'image', 'ip', 'private-ip', 'ipv6', 'type']
}