pragma solidity ^0.4.23;

contract StateChannel {
  event TimeOut(address sender);
  address public channelSender;
  address public channelRecipient;
  uint public startDate;
  uint public channelTimeout;
  mapping (bytes32 => address) signatures;

  constructor(address to, uint timeout) public payable {
    channelRecipient = to;
    channelSender = msg.sender;
    startDate = now;
    channelTimeout = timeout;
  }

  function getSigner(bytes32 h, uint8 v, bytes32 r, bytes32 s) pure public returns(address) {
    return ecrecover(h, v, r, s);
  }

  function closeChannel(bytes32 h, uint8 v, bytes32 r, bytes32 s, uint value) public{

    address signer;
    bytes32 proof;

    // get signer from signature
    signer = ecrecover(h, v, r, s);


    // signature is invalid, throw
    require(signer == channelSender || signer == channelRecipient);

    // proof = keccak256(this, value);
    proof = keccak256(abi.encodePacked(address(this), value));

    // signature is valid but doesn't match the data provided
    require(proof == h);

    if (signatures[proof] == 0) {
      signatures[proof] = signer;
    } else if (signatures[proof] != signer){
      // channel completed, both signatures provided
      require(channelRecipient.send(value));
      selfdestruct(channelSender);
    }

  }

  function ChannelTimeout() public {
    require(startDate + channelTimeout < now);
    emit TimeOut(channelSender);
    selfdestruct(channelSender);
  }

}
