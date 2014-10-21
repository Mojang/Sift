var aws = require('aws-sdk')
var util = require('../util')
var colors = require('colors')
// Todo search by both internal and external dns/ip? private-dns-name, private-ip-address
// Todo figure out how to do tags
var amazon = module.exports = {
  search: function (account, callback) {
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

    var result = []
    aws.config.update({ accessKeyId: account.publicToken, secretAccessKey: account.token })
    var todo = account.regions.length;
    account.regions.forEach(function (region) {
      amazon.searchRegion(region, params, function (servers) {
        servers.forEach(function (server) {
          server.Instances.forEach(function (instance) {
            var current_instance = {
              'id': instance.InstanceId,
              'name': amazon.findName(instance.Tags),
              'region': region,
              // Todo show ipv6? command line argument?
              'hostname': instance.PublicDnsName ? instance.PublicDnsName : instance.PublicIpAddress,
              'account': account,
              'image': instance.ImageId,
              'ip': instance.PublicIpAddress
            }
            for (var i in instance.Tags) {
              var tag = instance.Tags[i]
              current_instance['tag.' + tag.Key.toLowerCase()] = tag.Value
            }
            result.push(current_instance)
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
    // this.hasNextPage(), this.nextPage(callback)
    // Todo, error handling
    ec2.describeInstances(params, function(err, data) {
      if (err) {
        return console.log(err, err.stack)
      }
      if (data.NextToken) {
        console.log('NextToken found, more servers available')
      }
      callback(data.Reservations)
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