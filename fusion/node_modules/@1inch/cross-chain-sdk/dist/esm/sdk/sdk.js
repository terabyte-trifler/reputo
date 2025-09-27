import { encodeCancelOrder, MakerTraits } from '@1inch/fusion-sdk';
import { utils } from '@coral-xyz/anchor';
import assert from 'assert';
import { ResolverCancellationConfig } from '../cross-chain-order/index.js';
import { bufferToHex } from '../utils/index.js';
import { EvmAddress, SolanaAddress } from '../domains/addresses/index.js';
import { FusionApi, QuoterRequest, RelayerRequestEvm, QuoterCustomPresetRequest, ActiveOrdersRequest, OrdersByMakerRequest, OrderStatusRequest, RelayerRequestSvm, PaginationRequest } from '../api/index.js';
import { EvmCrossChainOrder } from '../cross-chain-order/evm/index.js';
import { isEvm, NetworkEnum } from '../chains.js';
export class SDK {
    config;
    api;
    constructor(config) {
        this.config = config;
        this.api = new FusionApi({
            url: config.url,
            httpProvider: config.httpProvider,
            authKey: config.authKey
        });
    }
    async getActiveOrders(params = {}) {
        const request = new ActiveOrdersRequest(params);
        return this.api.getActiveOrders(request);
    }
    async getOrderStatus(orderHash) {
        const request = new OrderStatusRequest({ orderHash });
        return this.api.getOrderStatus(request);
    }
    async getOrdersByMaker(params) {
        const request = new OrdersByMakerRequest(params);
        return this.api.getOrdersByMaker(request);
    }
    async getReadyToAcceptSecretFills(orderHash) {
        return this.api.getReadyToAcceptSecretFills(orderHash);
    }
    async getReadyToExecutePublicActions() {
        return this.api.getReadyToExecutePublicActions();
    }
    async getPublishedSecrets(orderHash) {
        return this.api.getPublishedSecrets(orderHash);
    }
    async submitSecret(orderHash, secret) {
        return this.api.submitSecret(orderHash, secret);
    }
    async getQuote(params) {
        const quoteParams = {
            srcChain: params.srcChainId,
            dstChain: params.dstChainId,
            srcTokenAddress: params.srcTokenAddress,
            dstTokenAddress: params.dstTokenAddress,
            amount: params.amount,
            walletAddress: params.walletAddress || EvmAddress.ZERO.toString(),
            permit: params.permit,
            enableEstimate: !!params.enableEstimate,
            fee: params?.takingFeeBps,
            source: params.source,
            isPermit2: params.isPermit2
        };
        if (QuoterRequest.isEvmRequest(quoteParams)) {
            const req = QuoterRequest.forEVM(quoteParams);
            return this.api.getQuote(req);
        }
        if (QuoterRequest.isSolanaRequest(quoteParams)) {
            const req = QuoterRequest.forSolana(quoteParams);
            return this.api.getQuote(req);
        }
        throw new Error('unknown request src chain');
    }
    async getQuoteWithCustomPreset(params, body) {
        const quoteParams = {
            srcChain: params.srcChainId,
            dstChain: params.dstChainId,
            srcTokenAddress: params.srcTokenAddress,
            dstTokenAddress: params.dstTokenAddress,
            amount: params.amount,
            walletAddress: params.walletAddress,
            permit: params.permit,
            enableEstimate: !!params.enableEstimate,
            fee: params?.takingFeeBps,
            source: params.source,
            isPermit2: params.isPermit2
        };
        const bodyRequest = new QuoterCustomPresetRequest({
            customPreset: body.customPreset
        });
        if (QuoterRequest.isEvmRequest(quoteParams)) {
            const req = QuoterRequest.forEVM(quoteParams);
            return this.api.getQuoteWithCustomPreset(req, bodyRequest);
        }
        if (QuoterRequest.isSolanaRequest(quoteParams)) {
            const req = QuoterRequest.forSolana(quoteParams);
            return this.api.getQuoteWithCustomPreset(req, bodyRequest);
        }
        throw new Error('unknown request src chain');
    }
    createOrder(quote, params) {
        if (!quote.quoteId) {
            throw new Error('request quote with enableEstimate=true');
        }
        const order = this.quoteToOrder(quote, params);
        const hash = order.getOrderHash(quote.srcChainId);
        return { order, hash, quoteId: quote.quoteId };
    }
    async submitOrder(srcChainId, order, quoteId, secretHashes) {
        if (!this.config.blockchainProvider) {
            throw new Error('blockchainProvider has not set to config');
        }
        if (!order.multipleFillsAllowed && secretHashes.length > 1) {
            throw new Error('with disabled multiple fills you provided secretHashes > 1');
        }
        else if (order.multipleFillsAllowed && secretHashes) {
            const secretCount = order.escrowExtension.hashLockInfo.getPartsCount() + 1n;
            if (secretHashes.length !== Number(secretCount)) {
                throw new Error('secretHashes length should be equal to number of secrets');
            }
        }
        const orderStruct = order.build();
        const signature = await this.config.blockchainProvider.signTypedData(orderStruct.maker, order.getTypedData(srcChainId));
        const relayerRequest = new RelayerRequestEvm({
            srcChainId,
            order: orderStruct,
            signature,
            quoteId,
            extension: order.extension.encode(),
            secretHashes: secretHashes.length === 1 ? undefined : secretHashes
        });
        await this.api.submitOrder(relayerRequest);
        return {
            order: orderStruct,
            signature,
            quoteId,
            orderHash: order.getOrderHash(srcChainId),
            extension: relayerRequest.extension
        };
    }
    /**
     * Announce solana order to relayer before on chain creation,
     * It's required because on chain data does not contains auction details
     *
     * @param order
     * @param quoteId
     * @param secretHashes
     *
     * @returns orderHash
     */
    async announceOrder(order, quoteId, secretHashes) {
        if (!order.multipleFillsAllowed && secretHashes.length > 1) {
            throw new Error('with disabled multiple fills you provided secretHashes > 1');
        }
        else if (order.multipleFillsAllowed && secretHashes) {
            const secretCount = order.hashLock.getPartsCount() + 1n;
            if (secretHashes.length !== Number(secretCount)) {
                throw new Error('secretHashes length should be equal to number of secrets');
            }
        }
        const relayerRequest = new RelayerRequestSvm({
            order: order.toJSON(),
            auctionOrderHash: bufferToHex(order.auction.hashForSolana()),
            quoteId,
            secretHashes: secretHashes.length === 1 ? undefined : secretHashes
        });
        await this.api.submitOrder(relayerRequest);
        return order.getOrderHash(NetworkEnum.SOLANA);
    }
    async placeOrder(quote, params) {
        const { order, quoteId } = this.createOrder(quote, params);
        assert(order instanceof EvmCrossChainOrder, 'solana order must be announced with announceOrder and placed onchain');
        return this.submitOrder(quote.srcChainId, order, quoteId, params.secretHashes);
    }
    /**
     * Only for orders with src chain in EVM
     *
     * @throws Error for non EVM srcChain
     */
    async buildCancelOrderCallData(orderHash) {
        const getOrderRequest = new OrderStatusRequest({ orderHash });
        const orderData = await this.api.getOrderStatus(getOrderRequest);
        if (!orderData) {
            throw new Error(`Can not get order with the specified orderHash ${orderHash}`);
        }
        assert(isEvm(orderData.srcChainId) && 'extension' in orderData, // extension check needed for TS
        'expected evm src chain');
        return encodeCancelOrder(orderHash, new MakerTraits(BigInt(orderData.order.makerTraits)));
    }
    /**
     * Returns on chain created orders which can be cancelled by resolver for premium
     */
    async getCancellableOrders(page = 1, limit = 100) {
        const orders = await this.api.getCancellableOrders(new PaginationRequest(page, limit));
        return {
            ...orders,
            items: orders.items.map((o) => ({
                maker: SolanaAddress.fromString(o.maker),
                token: SolanaAddress.fromString(o.order.orderInfo.srcToken),
                orderHash: utils.bytes.bs58.decode(o.orderHash),
                cancellationConfig: new ResolverCancellationConfig(BigInt(o.order.extra.resolverCancellationConfig
                    .maxCancellationPremium), o.order.extra.resolverCancellationConfig.cancellationAuctionDuration),
                isAssetNative: o.order.extra.srcAssetIsNative
            }))
        };
    }
    quoteToOrder(quote, params) {
        if (quote.isEvmQuote()) {
            return quote.createEvmOrder({
                hashLock: params.hashLock,
                receiver: params.receiver
                    ? EvmAddress.fromString(params.receiver)
                    : undefined,
                preset: params.preset,
                nonce: params.nonce,
                takingFeeReceiver: params.fee?.takingFeeReceiver,
                permit: params.permit,
                isPermit2: params.isPermit2
            });
        }
        assert(params.receiver, 'receiver is required for solana order');
        return quote.createSolanaOrder({
            hashLock: params.hashLock,
            receiver: EvmAddress.fromString(params.receiver),
            preset: params.preset,
            takingFeeReceiver: params.fee?.takingFeeReceiver
        });
    }
}
//# sourceMappingURL=sdk.js.map