var aws = require('aws-sdk')
var util = require('../util')
var colors = require('colors')
var amazon = module.exports = {

  search: function (account, callback) {
    var result = []
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

    aws.config.update({ accessKeyId: account.public_token, secretAccessKey: account.token })
    var todo = account.regions.length;
    account.regions.forEach(function (region) {
      search_region(region, params, function (err, servers) {
        if (err) {
         console.log('Something went wrong while searching Amazon %s'.red, err)
        } else {
          servers.forEach(function (server) {
            server.Instances.forEach(function (instance) {
              var current_instance = {
                'id': instance.InstanceId,
                'name': find_name(instance.Tags),
                'region': region,
                'hostname': instance.PublicDnsName ? instance.PublicDnsName : instance.PublicIpAddress,
                'account': account,
                'image': instance.ImageId,
                'ip': instance.PublicIpAddress,
                'keypair': instance.KeyName,
                'private-hostname': instance.PrivateDnsName,
                'private-ip': instance.PrivateIpAddress,
                'type': instance.InstanceType,
                'availability-zone': instance.Placement.AvailabilityZone
              }
              instance.Tags.forEach(function (tag) {
                current_instance['tag.' + tag.Key.toLowerCase()] = tag.Value
              })
              current_instance['security-group'] = []
              instance.SecurityGroups.forEach(function (sec) {
                current_instance['security-group'].push(sec.GroupId)
                current_instance['security-group'].push(sec.GroupName)
              })
              result.push(current_instance)
            })
          })
        }
        todo--;
        if (todo == 0) {
          callback(result);
        }
      })
    })
  },

  ssh: function (server, user, port, keyfile, options, command, disable_tt) {
    util.ssh(server, user, port, keyfile, options, command, disable_tt)
  },

  display: function (server, index) {
    util.display(server, index)
  },

  regions: ['ap-northeast-1', 'ap-southeast-1', 'ap-southeast-2', 'eu-west-1', 'sa-east-1', 'us-east-1', 'us-west-1', 'us-west-2'],

  keys: ['id', 'name', 'region', 'hostname', 'account', 'image', 'ip', 'private-ip', 'private-hostname', 'keypair', 'type', 'security-group', 'availability-zone']
}

var search_region = function (region, params, next) {
  var ec2 = new aws.EC2({ region: region })
  var results = []
  
  var describeInstances = function (params, done) {
    ec2.describeInstances(params, function (err, data) {
      if (err) {
        return done(error)
      }
      
      results.push(data.Reservations)
      
      if (data.NextToken) {
        params.NextToken = data.NextToken
        return describeInstances(params, done)
      }
      
      return done()
    })
  }
  
  describeInstances(params, function (error) {
    var result = []
    results.forEach(function (servers) {
      result = result.concat(servers)
    })
    return next(error, result)
  })
}


var find_name = function (tags) {
  var result = tags.filter(function (element) {
    return element.Key == 'Name'
  })
  return result[0].Value
}