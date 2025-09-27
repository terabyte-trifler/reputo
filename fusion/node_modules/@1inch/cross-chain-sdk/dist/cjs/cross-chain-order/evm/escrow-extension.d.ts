import { FusionExtension, Extension, Interaction, SettlementPostInteractionData } from '@1inch/fusion-sdk';
import { AddressComplement } from '../../domains/addresses/address-complement.js';
import { AuctionDetails } from '../../domains/auction-details/index.js';
import { HashLock } from '../../domains/hash-lock/index.js';
import { TimeLocks } from '../../domains/time-locks/index.js';
import { SupportedChain } from '../../chains.js';
import { AddressLike, EvmAddress as Address } from '../../domains/addresses/index.js';
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
export declare class EscrowExtension extends FusionExtension {
    readonly hashLockInfo: HashLock;
    readonly dstChainId: SupportedChain;
    readonly dstToken: AddressLike;
    readonly srcSafetyDeposit: bigint;
    readonly dstSafetyDeposit: bigint;
    readonly timeLocks: TimeLocks;
    readonly dstAddressFirstPart: AddressComplement;
    private static EXTRA_DATA_TYPES;
    private static EXTRA_DATA_LENGTH;
    constructor(address: Address, auctionDetails: AuctionDetails, postInteractionData: SettlementPostInteractionData, makerPermit: Interaction | undefined, hashLockInfo: HashLock, dstChainId: SupportedChain, dstToken: AddressLike, srcSafetyDeposit: bigint, dstSafetyDeposit: bigint, timeLocks: TimeLocks, dstAddressFirstPart?: AddressComplement);
    /**
     * Create EscrowExtension from bytes
     * @param bytes 0x prefixed bytes
     */
    static decode(bytes: string): EscrowExtension;
    static fromExtension(extension: Extension): EscrowExtension;
    /**
     * Decode escrow data not related to fusion
     *
     * @param bytes 0x prefixed bytes
     */
    private static decodeExtraData;
    build(): Extension;
    private buildCustomData;
    private encodeExtraData;
}
