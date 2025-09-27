"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscrowExtension = void 0;
const ethers_1 = require("ethers");
const byte_utils_1 = require("@1inch/byte-utils");
const fusion_sdk_1 = require("@1inch/fusion-sdk");
const assert_1 = __importDefault(require("assert"));
const address_complement_js_1 = require("../../domains/addresses/address-complement.js");
const index_js_1 = require("../../domains/auction-details/index.js");
const index_js_2 = require("../../domains/hash-lock/index.js");
const index_js_3 = require("../../domains/time-locks/index.js");
const index_js_4 = require("../../domains/addresses/index.js");
/**
 * Same as FusionExtension, but with extra data at the end
 * Extra data contains next fields:
 * - hashLock
 * - dstChainId
 * - dstToken
 * - srcSafetyDeposit
 * - dstSafetyDeposit
 * - timeLocks
 */
class EscrowExtension extends fusion_sdk_1.FusionExtension {
    hashLockInfo;
    dstChainId;
    dstToken;
    srcSafetyDeposit;
    dstSafetyDeposit;
    timeLocks;
    dstAddressFirstPart;
    static EXTRA_DATA_TYPES = [
        index_js_2.HashLock.Web3Type,
        'uint256', // dst chain id
        'uint256', // dst token
        'uint256', // src/dst safety deposit
        index_js_3.TimeLocks.Web3Type
    ];
    static EXTRA_DATA_LENGTH = 160 * 2; // 160 bytes, so 320 hex chars
    // eslint-disable-next-line max-params
    constructor(address, auctionDetails, postInteractionData, makerPermit, hashLockInfo, dstChainId, dstToken, srcSafetyDeposit, dstSafetyDeposit, timeLocks, dstAddressFirstPart = address_complement_js_1.AddressComplement.ZERO) {
        (0, assert_1.default)(srcSafetyDeposit <= byte_utils_1.UINT_128_MAX);
        (0, assert_1.default)(srcSafetyDeposit <= byte_utils_1.UINT_128_MAX);
        super(address.inner, auctionDetails, postInteractionData, makerPermit);
        this.hashLockInfo = hashLockInfo;
        this.dstChainId = dstChainId;
        this.dstToken = dstToken;
        this.srcSafetyDeposit = srcSafetyDeposit;
        this.dstSafetyDeposit = dstSafetyDeposit;
        this.timeLocks = timeLocks;
        this.dstAddressFirstPart = dstAddressFirstPart;
        this.dstToken = dstToken.zeroAsNative();
    }
    /**
     * Create EscrowExtension from bytes
     * @param bytes 0x prefixed bytes
     */
    static decode(bytes) {
        const extension = fusion_sdk_1.Extension.decode(bytes);
        return EscrowExtension.fromExtension(extension);
    }
    static fromExtension(extension) {
        const fusionExt = fusion_sdk_1.FusionExtension.fromExtension(new fusion_sdk_1.Extension({
            ...extension,
            postInteraction: extension.postInteraction.slice(0, -EscrowExtension.EXTRA_DATA_LENGTH)
        }));
        const extra = EscrowExtension.decodeExtraData('0x' +
            extension.postInteraction.slice(-EscrowExtension.EXTRA_DATA_LENGTH));
        const complement = extension.customData === fusion_sdk_1.ZX
            ? address_complement_js_1.AddressComplement.ZERO
            : new address_complement_js_1.AddressComplement(BigInt(extension.customData));
        return new EscrowExtension(index_js_4.EvmAddress.fromString(fusionExt.address.toString()), index_js_1.AuctionDetails.fromBase(fusionExt.auctionDetails), fusionExt.postInteractionData, fusionExt.makerPermit, extra.hashLock, extra.dstChainId, extra.dstToken, extra.srcSafetyDeposit, extra.dstSafetyDeposit, extra.timeLocks, complement);
    }
    /**
     * Decode escrow data not related to fusion
     *
     * @param bytes 0x prefixed bytes
     */
    static decodeExtraData(bytes) {
        const [hashLock, dstChainId, dstToken, safetyDeposit, timeLocks] = ethers_1.AbiCoder.defaultAbiCoder().decode(EscrowExtension.EXTRA_DATA_TYPES, bytes);
        const safetyDepositBN = new byte_utils_1.BN(safetyDeposit);
        return {
            hashLock: index_js_2.HashLock.fromString(hashLock),
            dstChainId: Number(dstChainId),
            dstToken: (0, index_js_4.createAddress)(dstToken.toString(), Number(dstChainId)),
            dstSafetyDeposit: safetyDepositBN.getMask(new byte_utils_1.BitMask(0n, 128n))
                .value,
            srcSafetyDeposit: safetyDepositBN.getMask(new byte_utils_1.BitMask(128n, 256n))
                .value,
            timeLocks: index_js_3.TimeLocks.fromBigInt(timeLocks)
        };
    }
    build() {
        const baseExt = super.build();
        return new fusion_sdk_1.Extension({
            ...baseExt,
            postInteraction: baseExt.postInteraction + (0, byte_utils_1.trim0x)(this.encodeExtraData()),
            customData: this.buildCustomData()
        });
    }
    buildCustomData() {
        if (!this.dstAddressFirstPart || this.dstAddressFirstPart.isZero()) {
            return fusion_sdk_1.ZX;
        }
        return this.dstAddressFirstPart.asHex();
    }
    encodeExtraData() {
        return ethers_1.AbiCoder.defaultAbiCoder().encode(EscrowExtension.EXTRA_DATA_TYPES, [
            this.hashLockInfo.toString(),
            this.dstChainId,
            this.dstToken.nativeAsZero().toHex(),
            (this.srcSafetyDeposit << 128n) | this.dstSafetyDeposit,
            this.timeLocks.build()
        ]);
    }
}
exports.EscrowExtension = EscrowExtension;
//# sourceMappingURL=escrow-extension.js.map