var aws = require('aws-sdk')
var util = require('../util')
var async = require('async')
module.exports = {

  search: function (account, callback) {
    var params = {
      Filters: [
        {
          Name: 'instance-state-name',
          Values: [
            'running'
          ]
        }
      ]
    }

    if (account.public_token && account.token) {
      aws.config.update({ accessKeyId: account.public_token, secretAccessKey: account.token })
    } else if (account.profile) {
      aws.config.credentials = new aws.SharedIniFileCredentials({ profile: account.profile })
    } else if (!account.iam) {
      delete aws.config.credentials
    }

    async.concat(account.regions, function (region, next) {
      var result = []

      function handle_search (error, servers) {
        servers.forEach(iterate_instances)
        next(error, result)
      }

      function iterate_instances (server) {
        server.Instances.forEach(function (instance) {
          serialize_instance(instance)
        })
      }

      function serialize_instance (instance) {
        var output = {
          'id': instance.InstanceId,
          'name': find_name(instance.Tags),
          'region': region,
          'hostname': instance.PublicDnsName ? instance.PublicDnsName : (instance.PublicIpAddress ? instance.PublicIpAddress : instance.PrivateIpAddress),
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
          output['tag.' + tag.Key.toLowerCase()] = tag.Value
        })

        output['security-group'] = []
        instance.SecurityGroups.forEach(function (sec) {
          output['security-group'].push(sec.GroupId)
          output['security-group'].push(sec.GroupName)
        })

        result.push(output)
      }

      search_region(region, params, handle_search)
    }, function (error, instances) {
      if (error) {
        console.log('Something went wrong while searching Amazon %s'.red, error)
        return callback([])
      }

      callback(instances)
    })

  },

  ssh: function (server, options) {
    util.ssh(server, options)
  },

  display: function (server, index) {
    util.display(server, index)
  },

  regions: ['ap-northeast-1', 'ap-southeast-1', 'ap-southeast-2', 'eu-central-1', 'eu-west-1', 'sa-east-1', 'us-east-1', 'us-west-1', 'us-west-2'],

  keys: ['id', 'name', 'region', 'hostname', 'account', 'image', 'ip', 'private-ip', 'private-hostname', 'keypair', 'type', 'security-group', 'availability-zone', 'tag.*']
}

var search_region = function (region, params, next) {
  var ec2 = new aws.EC2({ region: region })
  var results = []

  var describe_instances = function (params, done) {
    ec2.describeInstances(params, function (error, data) {
      if (error) {
        return done(error)
      }

      results.push(data.Reservations)

      if (data.NextToken) {
        params.NextToken = data.NextToken
        return describe_instances(params, done)
      }

      return done()
    })
  }

  describe_instances(params, function (error) {
    var result = []
    results.forEach(function (servers) {
      result = result.concat(servers)
    })
    return next(error, result)
  })
}

var find_name = function (tags) {
  var result = tags.filter(function (element) {
    return element.Key === 'Name'
  })
  if (result && result.length) {
    return result[0].Value
  } else {
    return ''
  }
}
