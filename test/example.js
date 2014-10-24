var should = require('should')
describe('Example', function() {
  before(function (done) {
    // Pre-setup if needed
    done()
  });
  it('1+1=2', function (done) {
    (1+1).should.equal(2)
    done()
  })
})