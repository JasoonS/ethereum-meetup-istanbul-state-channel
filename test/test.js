const StateChannel = artifacts.require('StateChannel')

const computeSignature = (amount, sendingAddress, contractAddress, web3) => {
  const idString = (amount).toString(16)
  const hashInput = web3.toHex(contractAddress).slice(2) + '0'.repeat(64 - idString.length) + idString
  // console.log(idString)
  const hash = web3.sha3(idString, { encoding: 'hex' })

  // break the signature into its components. For example see: https://ethereum.stackexchange.com/q/15364/4642
  const signature = web3.eth.sign(sendingAddress, hash);
  const r = signature.slice(0, 66);
  const s = '0x' + signature.slice(66, 130);
  const v =  web3.toDecimal('0x' + signature.slice(130, 132)) + 27

  // this prefix is required by the `ecrecover` builtin solidity function (other than that it is pretty arbitrary)
  const prefix = "\x19Ethereum Signed Message:\n32";
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
  const to = accounts[1]
  let contractAddress
  let value
  beforeEach(async () => {
    SC = await StateChannel.new(to, 999, { from: sender, value: 10000000 })
    contractAddress = SC.address
    value = Math.floor(Math.random() * 1000)
  })
  describe('getSigner', () => {
    it('should correctly return the address of the signer', async () => {
      const {
        prefixedHash,
        r,
        s,
        v,
      } = computeSignature(21, sender, contractAddress, web3)
      const result = await SC.getSigner(prefixedHash, v, r, s)

      assert(sender === result)
    })
  })
})
