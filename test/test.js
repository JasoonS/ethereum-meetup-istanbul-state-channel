const timeManager = require('openzeppelin-solidity/test/helpers/increaseTime')
const currentTime = require('openzeppelin-solidity/test/helpers/latestTime')
const { assertRevert, should, getContractCode } = require("./helpers")
const truffleAssert = require('truffle-assertions')
const { computeSignature } = require('./util')
const { expect } = require('chai')

const StateChannel = artifacts.require('StateChannel')

contract("StateChannel", (accounts) => {
  let SC
  const sender = accounts[0]
  const receiver = accounts[1]
  const attacker = accounts[2]
  const channelValue = 10000000
  const gassPrice = 100000000000
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

     prefixedHash.should.be.equal(refSig.prefixedHash)
     r.should.be.equal(refSig.r)
     s.should.be.equal(refSig.s)
     v.should.be.equal(refSig.v)
     sender.should.be.equal(result)
    })
    it('should should not return the correct values if the signer if the value given is incorrect', async () => {
      const {
        prefixedHash,
        r,
        s,
        v,
      } = computeSignature(value + 1, sender, contractAddress, web3)
      const result = await SC.getSigner(prefixedHash, v, r, s)

      prefixedHash.should.not.be.equal(refSig.prefixedHash)
      r.should.not.be.equal(refSig.r)
      s.should.not.be.equal(refSig.s)
      sender.should.be.equal(result)
    })
    it('should should not return the address of the signer if the contract address given is incorrect', async () => {
      const {
        prefixedHash,
        r,
        s,
        v,
      } = computeSignature(value, attacker, contractAddress, web3)
      const result = await SC.getSigner(prefixedHash, v, r, s)

      prefixedHash.should.be.equal(refSig.prefixedHash)
      r.should.not.be.equal(refSig.r)
      s.should.not.be.equal(refSig.s)
      sender.should.not.be.equal(result)
    })
    it('should should not return the address of the signer if the hash given is incorrect', async () => {
      const {
        prefixedHash,
        r,
        s,
        v,
      } = computeSignature(value, sender, attacker, web3)
      const result = await SC.getSigner(prefixedHash, v, r, s)

      prefixedHash.should.not.be.equal(refSig.prefixedHash)
      r.should.not.be.equal(refSig.r)
      s.should.not.be.equal(refSig.s)
      sender.should.be.equal(result)
    })
  })

  describe('closeChannel', () => {
    before(async () => {
      SC = await StateChannel.new(receiver, 999, { from: sender, value: channelValue })
      contractAddress = SC.address
    })

    it('should close the channel and make the payment if the user', async () => {
      const senderBalanceBefore = await web3.eth.getBalance(sender)
      const receiverBalanceBefore = await web3.eth.getBalance(receiver)
      const contractBalanceBefore = await web3.eth.getBalance(contractAddress)
      const sendValue = Math.floor(Math.random() * channelValue)
      const senderSig = computeSignature(sendValue, sender, contractAddress, web3)
      const receiverSig = computeSignature(sendValue, receiver, contractAddress, web3)

      contractBalanceBefore.should.be.bignumber.equal(channelValue)

      const contractCodeBefore = await getContractCode(contractAddress, web3)
      expect(contractCodeBefore).to.not.be.equal('0x0')

      const tx1 = await SC.closeChannel(senderSig.prefixedHash, senderSig.v, senderSig.r, senderSig.s, sendValue, { from: receiver, gassPrice })
      const gassTx1 = tx1.receipt.cumulativeGasUsed * gassPrice
      const tx2 = await SC.closeChannel(receiverSig.prefixedHash, receiverSig.v, receiverSig.r, receiverSig.s, sendValue, { from: receiver, gassPrice })
      const gassTx2 = tx2.receipt.cumulativeGasUsed * gassPrice


      const senderBalanceAfter = await web3.eth.getBalance(sender)
      const receiverBalanceAfter = await web3.eth.getBalance(receiver)
      const contractBalanceAfter = await web3.eth.getBalance(contractAddress)

      senderBalanceAfter.should.be.bignumber.equal(senderBalanceBefore.add(channelValue).sub(sendValue))
      receiverBalanceAfter.should.be.bignumber.equal(receiverBalanceBefore.add(sendValue).sub(gassTx1 + gassTx2))
      contractBalanceAfter.should.be.bignumber.equal(0)

      // the contract should be destroyed
      const contractCodeAfter = await getContractCode(contractAddress, web3)
      expect(contractCodeAfter).to.be.equal('0x0')
      contractCodeAfter.should.be.equal('0x0')
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
