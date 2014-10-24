var nautical = require('nautical')
var util = require('../util')
var digitalOcean = module.exports = {

  search: function (account, callback) {
    var result = []
    var client = nautical.getClient({ token: account.token })
    client.droplets.list(function (err, reply) {
      if (err) {
        console.log('Something went wrong when searching DigitalOcean: %s'.red, err)
      } else {
        var servers = reply.body.droplets;
        //Todo get next page
        /*// get the next page
            if ('function' === typeof reply.next)
                reply.next(callback);
              else
                  console.log(imageList);*/
        servers.forEach(function (server) {
          result.push({
            'id': server.id,
            'name': server.name,
            'region': server.region.slug,
            'hostname': server.networks.v4[0].ip_address,
            'account': account,
            'image': server.image.id,
            'ip': server.networks.v4[0].ip_address,
            'type': server.size.slug
          })
        })
      }
      callback(result)
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