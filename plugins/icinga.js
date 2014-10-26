var colors = require('colors')
var unirest = require('unirest')
var util = require('../util')
var icinga = module.exports = {

  filter: function(config, callback) {
    var filters = ''
    if (config.icinga_host == null || config.icinga_user == null || config.icinga_pass == null) {
      console.log('Please define icinga_host, icinga_user & icinga_pass in the config'.red);
      return callback('')
    }

    unirest.get(((util.starts_with(config.icinga_host, 'http://') || util.starts_with(config.icinga_host, 'https://')) ? config.icinga_host : 'http://' + config.icinga_host) + '/cgi-bin/icinga/status.cgi?host=all&type=detail&servicestatustypes=16&hoststatustypes=3&serviceprops=2097162&nostatusheader&jsonoutput').auth({
      user: config.icinga_user,
      pass: config.icinga_pass,
      sendImmediately: true
    }).as.json(function (response) {
      try {
        response.body = JSON.parse(response.body)
      } catch (error) {
        return console.log('Something went wrong when checking icinga'.red)
      }
      
      if (response.body.status == null || response.body.status.service_status == null) {} else {
        response.body.status.service_status.forEach(function (item) {
          filters += ' OR hostname = ' + item.host_name
        })
      }

      if (response.body.status == null || response.body.status.host_status == null) {} else {
        response.body.status.host_status.forEach(function (item) {
          filters += ' OR hostname = ' + item.host_name
        })
      }
     
      filters = filters.trim()
      filters = filters.substring(2)
     
      if (!filters.length) {
        console.log('No hosts are down, ignoring icinga filter'.red)
      }
     
      callback(filters)
    })
  }
}