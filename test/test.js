const timeManager = require('openzeppelin-solidity/test/helpers/increaseTime')
const currentTime = require('openzeppelin-solidity/test/helpers/latestTime')
const {assertRevert} = require("./helpers")
const truffleAssert = require('truffle-assertions')

const StateChannel = artifacts.require('StateChannel')
const computeSignature = (amount, sendingAddress, contractAddress, web3) => {
  const idString = (amount).toString(16)
  const hashInput = web3.toHex(contractAddress).slice(2) + '0'.repeat(64 - idString.length) + idString
  const hash = web3.sha3(hashInput, { encoding: 'hex' })

  // break the signature into its components. For example see: https://ethereum.stackexchange.com/q/15364/4642
  const signature = web3.eth.sign(sendingAddress, hash)
  const r = signature.slice(0, 66)
  const s = '0x' + signature.slice(66, 130)
  const v =  web3.toDecimal('0x' + signature.slice(130, 132)) + 27

  // this prefix is required by the `ecrecover` builtin solidity function (other than that it is pretty arbitrary)
  const prefix = "\x19Ethereum Signed Message:\n32"
  const prefixedBytes = web3.fromAscii(prefix) + hash.slice(2)
  const prefixedHash = web3.sha3(prefixedBytes, { encoding: 'hex' })

  return {
    hash,
    prefixedHash,
    signature,
    r,
    s,
    v,
  }
}

contract("StateChannel", (accounts) => {
  let SC
  const sender = accounts[0]
  const receiver = accounts[1]
  const attacker = accounts[2]
  const channelValue = 10000000
  let contractAddress
  let value
  describe('getSigner', () => {
    let refSig
    before(async () => {
      SC = await StateChannel.new(receiver, 999, { from: sender, value: channelValue })
      contractAddress = SC.address
      value = Math.floor(Math.random() * channelValue)

      refSig = computeSignature(value, sender, contractAddress, web3)
    })
    it('should correctly return the address of the signer predictably', async () => {
      const {
        prefixedHash,
        r,
        s,
        v,
      } = computeSignature(value, sender, contractAddress, web3)
      const result = await SC.getSigner(prefixedHash, v, r, s)

     assert(prefixedHash === refSig.prefixedHash)
     assert(r === refSig.r)
     assert(s === refSig.s)
     assert(v === refSig.v)
     assert(sender === result)
    })
    it('should should not return the correct values if the signer if the value given is incorrect', async () => {
      const {
        prefixedHash,
        r,
        s,
        v,
      } = computeSignature(value + 1, sender, contractAddress, web3)
      const result = await SC.getSigner(prefixedHash, v, r, s)

      assert(prefixedHash !== refSig.prefixedHash)
      assert(r !== refSig.r)
      assert(s !== refSig.s)
      assert(sender === result)
    })
    it('should should not return the address of the signer if the contract address given is incorrect', async () => {
      const {
        prefixedHash,
        r,
        s,
        v,
      } = computeSignature(value, attacker, contractAddress, web3)
      const result = await SC.getSigner(prefixedHash, v, r, s)

      assert(prefixedHash === refSig.prefixedHash)
      assert(r !== refSig.r)
      assert(s !== refSig.s)
      assert(sender !== result)
    })
    it('should should not return the address of the signer if the hash given is incorrect', async () => {
      const {
        prefixedHash,
        r,
        s,
        v,
      } = computeSignature(value, sender, attacker, web3)
      const result = await SC.getSigner(prefixedHash, v, r, s)

      assert(prefixedHash !== refSig.prefixedHash)
      assert(r !== refSig.r)
      assert(s !== refSig.s)
      assert(sender === result)
    })
  })

  describe('ChannelTimeout', () => {
    let SC
    beforeEach(async () => {
      SC = await StateChannel.new(receiver, 999, {from: sender, value: 10000000})
    })
    it('should revert if the Timout is still active', async () => {
      await assertRevert(SC.ChannelTimeout.sendTransaction({from:sender}))
    })
  })
})
