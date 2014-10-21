var aws = require('aws-sdk')
var util = require('../util')
var colors = require('colors')
// Todo search by both internal and external dns/ip? private-dns-name, private-ip-address
// Todo figure out how to do tags
var amazon = module.exports = {
  search: function (account, callback) {
    // Remove me
    //filters = [{ name: 'name', value: 'MojangStatus' }]
    //filters = [{ name: 'name', value: 'MojangStatus' }, { name: 'hostname', value: 'ec2-54-204-36-51.compute-1.amazonaws.com'}, { name: 'hostname', value: 'ec2-107-22-228-99.compute-1.amazonaws.com'}]
    var params = {
      Filters: [
        {
        Name: 'instance-state-name',
          Values: [
            'running',
          ]
        }
      ]
    }
   /* if (filters && filters.length > 0) {
      var filtersToAdd = {}
      filters.forEach(function (filter) {
        var name = filterNames[filter.name]
        if (name != null) {
          if (filtersToAdd[name] == null) {
            filtersToAdd[name] = { 
              Name: name, 
              Values: [ filter.value ] 
            }
          } else {
            filtersToAdd[name].Values.push(filter.value)
          }
        } else {
          console.log('Ignoring invalid filter %s'.red, filter.name)
        }
      })
      Object.keys(filtersToAdd).forEach(function (key) {
        var filter = filtersToAdd[key]
        params.Filters.push(filter)
      })
    }*/
    var result = []
    aws.config.update({ accessKeyId: account.publicToken, secretAccessKey: account.token })
    var todo = account.regions.length;
    account.regions.forEach(function (region) {
      amazon.searchRegion(region, params, function (servers) {
        servers.forEach(function (server) {
          result.push({
            'id': server.Instances[0].InstanceId,
            'name': amazon.findName(server.Instances[0].Tags),
            'region': region,
            // Todo show ipv6? command line argument?
            'hostname': server.Instances[0].PublicDnsName ? server.Instances[0].PublicDnsName : server.Instances[0].PublicIpAddress,
            'account': account,
            'image': server.Instances[0].ImageId,
            'ip': server.Instances[0].PublicIpAddress
          })
        })
        todo--;
        if (todo == 0) {
          callback(result);
        }
      })
    })
  },
  searchRegion: function (region, params, callback) {
    var ec2 = new aws.EC2({ region: region })
    // Todo, check for NextToken and use for pagination, in case of more than 1k servers
    // Todo, error handling
    ec2.describeInstances(params, function(err, data) {
      if (err) {
        return console.log(err, err.stack)
      }
      if (data.NextToken) {
        console.log('NextToken found, more servers available')
      }
      callback(data.Reservations)
      //console.log(data.Reservations[0].Instances[0].Placement.AvailabilityZone)
    })
  },
  findName: function (tags) {
    var result = tags.filter(function (element) {
      return element.Key == 'Name'
    })
    return result[0].Value
  },
  ssh: function (server, user, port, keyfile, options) {
    util.ssh(server, user, port, keyfile, options)
  },

  display: function (server, index) {
    util.display(server, index)
  },

  regions: ['ap-northeast-1', 'ap-southeast-1', 'ap-southeast-2', 'eu-west-1', 'sa-east-1', 'us-east-1', 'us-west-1', 'us-west-2']
}