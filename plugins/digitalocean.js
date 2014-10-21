var nautical = require('nautical')
var util = require('../util')
// Todo figure out how to do ip-range/like?
// Todo figure out how to do multiple values of same filter?
var digitalOcean = module.exports = {
  search: function (account, callback) {
    // Remove me
    //filters = [{ name: 'name', value: 'dmarby.se' }, { name: 'ip', value: '208.68.38.3' }, { name: 'ip', value: '104.131.1.207'}]
    var result = []
    var client = nautical.getClient({ token: account.token })
    client.droplets.list(function (err, reply) {
      var servers = reply.body.droplets;
      //Todo error handling
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
          // Todo show ipv6? command line argument?
          'hostname': server.networks.v4[0].ip_address,
          'type': 'digitalocean',
          'account': account,
          'image': server.image.id,
          'region': server.region.slug
        })
      })
      callback(result)
    })
  },
  // Todo option to use DNS for connection?
  ssh: function (server, user, port, keyfile, options) {
    util.ssh(server, user, port, keyfile, options)
  },

  display: function (server, index) {
    util.display(server, index)
  },

  regions: ['nyc1', 'ams1', 'sfo1', 'nyc2', 'ams2', 'sgp1', 'lon1', 'nyc3', 'ams3']
}