import { UINT_40_MAX } from '@1inch/byte-utils';
import { randBigInt } from '@1inch/fusion-sdk';
import assert from 'assert';
import { SvmCrossChainOrder } from '../../../cross-chain-order/index.js';
import { EvmAddress, SolanaAddress } from '../../../domains/addresses/index.js';
import { TimeLocks } from '../../../domains/time-locks/index.js';
import { PresetEnum } from '../types.js';
import { Preset } from '../preset.js';
import { EvmCrossChainOrder } from '../../../cross-chain-order/evm/index.js';
import { isEvm, isSolana } from '../../../chains.js';
export class Quote {
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
            [PresetEnum.fast]: new Preset(response.presets.fast),
            [PresetEnum.medium]: new Preset(response.presets.medium),
            [PresetEnum.slow]: new Preset(response.presets.slow),
            [PresetEnum.custom]: response.presets.custom
                ? new Preset(response.presets.custom)
                : undefined
        };
        const dstEscrowFactory = isEvm(request.dstChain)
            ? EvmAddress.fromString(response.dstEscrowFactory)
            : SolanaAddress.fromString(response.dstEscrowFactory);
        return new Quote(request, response.quoteId, BigInt(response.srcTokenAmount), BigInt(response.dstTokenAmount), presets, EvmAddress.fromString(response.srcEscrowFactory), dstEscrowFactory, response.timeLocks, BigInt(response.srcSafetyDeposit), BigInt(response.dstSafetyDeposit), response.whitelist.map((w) => EvmAddress.fromString(w)), response.recommendedPreset, response.prices, response.volume, response.autoK);
    }
    static fromSolanaQuote(request, response) {
        const presets = {
            [PresetEnum.fast]: new Preset(response.presets.fast),
            [PresetEnum.medium]: new Preset(response.presets.medium),
            [PresetEnum.slow]: new Preset(response.presets.slow),
            [PresetEnum.custom]: response.presets.custom
                ? new Preset(response.presets.custom)
                : undefined
        };
        const dstEscrowFactory = isEvm(request.dstChain)
            ? EvmAddress.fromString(response.dstEscrowFactory)
            : SolanaAddress.fromString(response.dstEscrowFactory);
        return new Quote(request, response.quoteId, BigInt(response.srcTokenAmount), BigInt(response.dstTokenAmount), presets, SolanaAddress.fromString(response.srcEscrowFactory), dstEscrowFactory, response.timeLocks, BigInt(response.srcSafetyDeposit), BigInt(response.dstSafetyDeposit), [], response.recommendedPreset, response.prices, response.volume, response.autoK);
    }
    createEvmOrder(params) {
        assert(this.isEvmQuote(), 'cannot create non evm order');
        const preset = this.getPreset(params?.preset || this.recommendedPreset);
        const auctionDetails = preset.createAuctionDetails(params.delayAuctionStartTimeBy);
        const allowPartialFills = preset.allowPartialFills;
        const allowMultipleFills = preset.allowMultipleFills;
        const isNonceRequired = !allowPartialFills || !allowMultipleFills;
        const nonce = isNonceRequired
            ? (params.nonce ?? randBigInt(UINT_40_MAX))
            : params.nonce;
        const takerAsset = this.params.dstTokenAddress.zeroAsNative();
        return EvmCrossChainOrder.new(this.srcEscrowFactory, {
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
            timeLocks: TimeLocks.new({
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
        assert(this.isSolanaQuote(), 'cannot create non solana order');
        assert(this.params.dstTokenAddress instanceof EvmAddress, 'dstToken must be evm address');
        const preset = this.getPreset(params?.preset || this.recommendedPreset);
        const auctionDetails = preset.createAuctionDetails(params.delayAuctionStartTimeBy);
        const allowMultipleFills = preset.allowMultipleFills;
        return SvmCrossChainOrder.new({
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
            timeLocks: TimeLocks.new({
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
        return isEvm(this.params.srcChain);
    }
    isSolanaQuote() {
        return isSolana(this.params.srcChain);
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
//# sourceMappingURL=quote.js.map