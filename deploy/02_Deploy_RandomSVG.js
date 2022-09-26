let { networkConfig, getNetworkIdFromName } = require("../helper-hardhat-config")
const fs = require("fs")
const { network, ethers } = require("hardhat")

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, log, get } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = await getChainId()
    let linkTokenAddress
    let vrfCoordinatorAddress

    if (chainId == 31337) {
        let linkToken = await get("LinkToken")
        // both the get and getContract have the same purpose, but getContract is only in the
        //latest versions of hh ethers
        let VRFCoordinatorMock = await ethers.getContract("VRFCoordinatorMock")
        linkTokenAddress = linkToken.address
        vrfCoordinatorAddress = VRFCoordinatorMock.address
        additionalMessage = " --linkaddress " + linkTokenAddress
    } else {
        linkTokenAddress = networkConfig[chainId]["linkToken"]
        vrfCoordinatorAddress = networkConfig[chainId]["vrfCoordinator"]
    }
    const keyHash = networkConfig[chainId]["keyHash"]
    const fee = networkConfig[chainId]["fee"]
    args = [vrfCoordinatorAddress, linkTokenAddress, keyHash, fee]
    log("----------------------------------------------------")
    const RandomSVG = await deploy("RandomSVG", {
        from: deployer,
        args: args,
        log: true,
    })
    log(`You have deployed an NFT contract to ${RandomSVG.address}`)
    const networkName = networkConfig[chainId]["name"]
    log(
        `Verify with:\n npx hardhat verify --network ${networkName} ${RandomSVG.address} ${args
            .toString()
            .replace(/,/g, " ")}`
    )
    // const RandomSVGContract = await ethers.getContractFactory("RandomSVG")
    const accounts = await hre.ethers.getSigners()
    const signer = accounts[0]
    // const randomSVG = new ethers.Contract(RandomSVG.address, RandomSVGContract.interface, signer)
    const randomSVG = await ethers.getContract('RandomSVG');

    // fund with LINK
    let networkId = await getNetworkIdFromName(network.name)
    const fundAmount = networkConfig[networkId]["fundAmount"]
    const linkTokenContract = await ethers.getContractFactory("LinkToken")
    const linkToken = new ethers.Contract(linkTokenAddress, linkTokenContract.interface, signer)
    let fund_tx = await linkToken.transfer(RandomSVG.address, fundAmount)
    await fund_tx.wait(1)
    // await new Promise(r => setTimeout(r, 5000))
    linkToken.balanceOf()
    log("Let's create an NFT now!")
    let tokenId
    console.log("02_before create");
    console.log(randomSVG.address);
    tx = await randomSVG.create({ gasLimit: 2500000, gasPrice: 2000000000})
    let receipt = await tx.wait(1)
    tokenId = receipt.events[3].topics[2]

    if (chainId != 31337) {
        // First we setup up a listener, and then we call the create tx
        // This is so we can be sure to not miss it!
        const timeout = new Promise((res) => setTimeout(res, 300000))
        // const listenForEvent = new Promise(async (resolve, reject) => {
        //     randomSVG.once("CreatedUnfinishedRandomSVG", async () => {
        //         tx = await randomSVG.finishMint(tokenId, { gasLimit: 2500000 });
        //         await tx.wait(1);
        //         log(
        //             `You can view the tokenURI here ${await randomSVG.tokenURI(
        //                 0
        //             )}`
        //         );
        //         resolve();
        //     });
        // });
        

        const finishTx = await randomSVG.finishMint(tokenId, { gasLimit: 2500000, gasValue: 200 })
        await finishTx.wait(1)
        log(`You can view the tokenURI here ${await randomSVG.tokenURI(0)}`)

        // const result = Promise.race([timeout, listenForEvent])
        // tx = await randomSVG.create({ gasLimit: 2500000 })
        // let receipt = await tx.wait(1)

        /*you must keep track of how many events are being generated in a func, and which event we 
        want to have work with. Also remember that, the topics are going to be the indexed params of
        events. But always, the topic[0] will be the hash of the event emitted and from topic[1],
        we will have the other indexed params!
        */

        // tokenId = receipt.events[3].topics[2]
        // log(`You've made your NFT! This is number ${tokenId.toString()}`)
        // log("Let's wait for the Chainlink VRF node to respond...")
        // await result
    } else {
        // tx = await randomSVG.create({ gasLimit: 2500000 })
        // let receipt = await tx.wait(1)

        // tokenId = receipt.events[3].topics[2]


        // const VRFCoordinatorMock = await deployments.get("VRFCoordinatorMock");
        // vrfCoordinator = await ethers.getContractAt(
        //     "VRFCoordinatorMock",
        //     VRFCoordinatorMock.address,
        //     signer
        // );
        vrfCoordinator = await ethers.getContract("VRFCoordinatorMock")

        //as here, we are acting as a chainlink node, and if we check the code of the mock,
        //we understand that the, node calls this function after generating a random value and
        //to serve it to the consumer
        let transactionResponse = await vrfCoordinator.callBackWithRandomness(
            //this is the requestID
            receipt.logs[3].topics[1],
            //this the random num we are passing, usually chainlink nodes pass it
            77777,
            //this is the consumer
            randomSVG.address
        )
        //to understand better abt the above params, we can check the Mock implementation
        await transactionResponse.wait(1)
        log(`Now let's finsih the mint...`)
        tx = await randomSVG.finishMint(tokenId, { gasLimit: 2500000 })
        await tx.wait(1)
    }
    log(`You can view the tokenURI here ${await randomSVG.tokenURI(0)}`)
}

module.exports.tags = ["all", "rsvg"]
