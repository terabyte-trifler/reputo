"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Quote = void 0;
const byte_utils_1 = require("@1inch/byte-utils");
const fusion_sdk_1 = require("@1inch/fusion-sdk");
const assert_1 = __importDefault(require("assert"));
const index_js_1 = require("../../../cross-chain-order/index.js");
const index_js_2 = require("../../../domains/addresses/index.js");
const index_js_3 = require("../../../domains/time-locks/index.js");
const types_js_1 = require("../types.js");
const preset_js_1 = require("../preset.js");
const index_js_4 = require("../../../cross-chain-order/evm/index.js");
const chains_js_1 = require("../../../chains.js");
class Quote {
    params;
    quoteId;
    srcTokenAmount;
    dstTokenAmount;
    presets;
    srcEscrowFactory;
    dstEscrowFactory;
    timeLocks;
    srcSafetyDeposit;
    dstSafetyDeposit;
    whitelist;
    recommendedPreset;
    prices;
    volume;
    slippage;
    // eslint-disable-next-line max-params
    constructor(params, quoteId, srcTokenAmount, dstTokenAmount, presets, srcEscrowFactory, dstEscrowFactory, timeLocks, srcSafetyDeposit, dstSafetyDeposit, whitelist, recommendedPreset, prices, volume, slippage) {
        this.params = params;
        this.quoteId = quoteId;
        this.srcTokenAmount = srcTokenAmount;
        this.dstTokenAmount = dstTokenAmount;
        this.presets = presets;
        this.srcEscrowFactory = srcEscrowFactory;
        this.dstEscrowFactory = dstEscrowFactory;
        this.timeLocks = timeLocks;
        this.srcSafetyDeposit = srcSafetyDeposit;
        this.dstSafetyDeposit = dstSafetyDeposit;
        this.whitelist = whitelist;
        this.recommendedPreset = recommendedPreset;
        this.prices = prices;
        this.volume = volume;
        this.slippage = slippage;
    }
    get srcChainId() {
        return this.params.srcChain;
    }
    get dstChainId() {
        return this.params.dstChain;
    }
    static fromEVMQuote(request, response) {
        const presets = {
            [types_js_1.PresetEnum.fast]: new preset_js_1.Preset(response.presets.fast),
            [types_js_1.PresetEnum.medium]: new preset_js_1.Preset(response.presets.medium),
            [types_js_1.PresetEnum.slow]: new preset_js_1.Preset(response.presets.slow),
            [types_js_1.PresetEnum.custom]: response.presets.custom
                ? new preset_js_1.Preset(response.presets.custom)
                : undefined
        };
        const dstEscrowFactory = (0, chains_js_1.isEvm)(request.dstChain)
            ? index_js_2.EvmAddress.fromString(response.dstEscrowFactory)
            : index_js_2.SolanaAddress.fromString(response.dstEscrowFactory);
        return new Quote(request, response.quoteId, BigInt(response.srcTokenAmount), BigInt(response.dstTokenAmount), presets, index_js_2.EvmAddress.fromString(response.srcEscrowFactory), dstEscrowFactory, response.timeLocks, BigInt(response.srcSafetyDeposit), BigInt(response.dstSafetyDeposit), response.whitelist.map((w) => index_js_2.EvmAddress.fromString(w)), response.recommendedPreset, response.prices, response.volume, response.autoK);
    }
    static fromSolanaQuote(request, response) {
        const presets = {
            [types_js_1.PresetEnum.fast]: new preset_js_1.Preset(response.presets.fast),
            [types_js_1.PresetEnum.medium]: new preset_js_1.Preset(response.presets.medium),
            [types_js_1.PresetEnum.slow]: new preset_js_1.Preset(response.presets.slow),
            [types_js_1.PresetEnum.custom]: response.presets.custom
                ? new preset_js_1.Preset(response.presets.custom)
                : undefined
        };
        const dstEscrowFactory = (0, chains_js_1.isEvm)(request.dstChain)
            ? index_js_2.EvmAddress.fromString(response.dstEscrowFactory)
            : index_js_2.SolanaAddress.fromString(response.dstEscrowFactory);
        return new Quote(request, response.quoteId, BigInt(response.srcTokenAmount), BigInt(response.dstTokenAmount), presets, index_js_2.SolanaAddress.fromString(response.srcEscrowFactory), dstEscrowFactory, response.timeLocks, BigInt(response.srcSafetyDeposit), BigInt(response.dstSafetyDeposit), [], response.recommendedPreset, response.prices, response.volume, response.autoK);
    }
    createEvmOrder(params) {
        (0, assert_1.default)(this.isEvmQuote(), 'cannot create non evm order');
        const preset = this.getPreset(params?.preset || this.recommendedPreset);
        const auctionDetails = preset.createAuctionDetails(params.delayAuctionStartTimeBy);
        const allowPartialFills = preset.allowPartialFills;
        const allowMultipleFills = preset.allowMultipleFills;
        const isNonceRequired = !allowPartialFills || !allowMultipleFills;
        const nonce = isNonceRequired
            ? (params.nonce ?? (0, fusion_sdk_1.randBigInt)(byte_utils_1.UINT_40_MAX))
            : params.nonce;
        const takerAsset = this.params.dstTokenAddress.zeroAsNative();
        return index_js_4.EvmCrossChainOrder.new(this.srcEscrowFactory, {
            makerAsset: this.params.srcTokenAddress,
            takerAsset: takerAsset,
            makingAmount: this.srcTokenAmount,
            takingAmount: preset.auctionEndAmount,
            maker: this.params.walletAddress,
            receiver: params.receiver
        }, {
            hashLock: params.hashLock,
            srcChainId: this.params.srcChain,
            dstChainId: this.params.dstChain,
            srcSafetyDeposit: this.srcSafetyDeposit,
            dstSafetyDeposit: this.dstSafetyDeposit,
            timeLocks: index_js_3.TimeLocks.new({
                srcWithdrawal: BigInt(this.timeLocks.srcWithdrawal),
                srcPublicWithdrawal: BigInt(this.timeLocks.srcPublicWithdrawal),
                srcCancellation: BigInt(this.timeLocks.srcCancellation),
                srcPublicCancellation: BigInt(this.timeLocks.srcPublicCancellation),
                dstWithdrawal: BigInt(this.timeLocks.dstWithdrawal),
                dstPublicWithdrawal: BigInt(this.timeLocks.dstPublicWithdrawal),
                dstCancellation: BigInt(this.timeLocks.dstCancellation)
            })
        }, {
            auction: auctionDetails,
            whitelist: this.getWhitelist(auctionDetails.startTime, preset.exclusiveResolver)
        }, {
            nonce,
            permit: params.permit,
            allowPartialFills,
            allowMultipleFills,
            orderExpirationDelay: params?.orderExpirationDelay,
            source: this.params.source,
            enablePermit2: params.isPermit2
        });
    }
    createSolanaOrder(params) {
        (0, assert_1.default)(this.isSolanaQuote(), 'cannot create non solana order');
        (0, assert_1.default)(this.params.dstTokenAddress instanceof index_js_2.EvmAddress, 'dstToken must be evm address');
        const preset = this.getPreset(params?.preset || this.recommendedPreset);
        const auctionDetails = preset.createAuctionDetails(params.delayAuctionStartTimeBy);
        const allowMultipleFills = preset.allowMultipleFills;
        return index_js_1.SvmCrossChainOrder.new({
            srcToken: this.params.srcTokenAddress,
            dstToken: this.params.dstTokenAddress,
            srcAmount: this.srcTokenAmount,
            minDstAmount: preset.auctionEndAmount,
            maker: this.params.walletAddress,
            receiver: params.receiver
        }, {
            hashLock: params.hashLock,
            srcChainId: this.params.srcChain,
            dstChainId: this.params.dstChain,
            srcSafetyDeposit: this.srcSafetyDeposit,
            dstSafetyDeposit: this.dstSafetyDeposit,
            timeLocks: index_js_3.TimeLocks.new({
                srcWithdrawal: BigInt(this.timeLocks.srcWithdrawal),
                srcPublicWithdrawal: BigInt(this.timeLocks.srcPublicWithdrawal),
                srcCancellation: BigInt(this.timeLocks.srcCancellation),
                srcPublicCancellation: BigInt(this.timeLocks.srcPublicCancellation),
                dstWithdrawal: BigInt(this.timeLocks.dstWithdrawal),
                dstPublicWithdrawal: BigInt(this.timeLocks.dstPublicWithdrawal),
                dstCancellation: BigInt(this.timeLocks.dstCancellation)
            })
        }, {
            auction: auctionDetails
        }, {
            allowMultipleFills,
            orderExpirationDelay: params?.orderExpirationDelay,
            source: this.params.source,
            resolverCancellationConfig: params?.resolverCancellationConfig,
            salt: params?.salt
        });
    }
    isEvmQuote() {
        return (0, chains_js_1.isEvm)(this.params.srcChain);
    }
    isSolanaQuote() {
        return (0, chains_js_1.isSolana)(this.params.srcChain);
    }
    getPreset(type = this.recommendedPreset) {
        return this.presets[type];
    }
    getWhitelist(auctionStartTime, exclusiveResolver) {
        if (exclusiveResolver) {
            return this.whitelist.map((resolver) => {
                const isExclusive = resolver.equal(exclusiveResolver);
                return {
                    address: resolver,
                    allowFrom: isExclusive ? 0n : auctionStartTime
                };
            });
        }
        return this.whitelist.map((resolver) => ({
            address: resolver,
            allowFrom: 0n
        }));
    }
}
exports.Quote = Quote;
//# sourceMappingURL=quote.js.map