'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Loader2,
    FileText,
    Image,
    Award,
    Clock,
    CheckCircle2,
    XCircle,
    Upload,
    ExternalLink,
    Plus,
    Shield,
    Gavel,
    DollarSign,
    Ban,
    Trophy,
    Trash2,
    ImagePlus,
    File
} from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { useWorkSubmission, usePINN44Token } from '@/hooks/useContracts';
import { CONTRACTS_CONFIG, getExplorerTxUrl } from '@/lib/contracts';

interface Bounty {
    id: number;
    title: string;
    description: string;
    rewardToken: string;
    rewardAmount: bigint;
    deadline: bigint;
    state: number;
    stakeRequired: bigint;
    stakeToken: string;
    submissionCount: number;
    funded: boolean;
    creator: string;
}

interface Submission {
    id: number;
    bountyId: number;
    submitter: string;
    fileUri: string;
    thumbnailUri: string;
    status: number; // 0: Pending, 1: Winner, 2: Rejected, 3: Refunded
    stakeAmount: bigint;
}

const BountyState = {
    0: { label: 'Open', color: 'bg-green-500' },
    1: { label: 'Judging', color: 'bg-yellow-500' },
    2: { label: 'Completed', color: 'bg-blue-500' },
    3: { label: 'Cancelled', color: 'bg-red-500' },
};

const SubmissionStatus = {
    0: { label: 'Pending', color: 'bg-gray-500' },
    1: { label: 'Winner', color: 'bg-green-500' },
    2: { label: 'Rejected', color: 'bg-red-500' },
    3: { label: 'Refunded', color: 'bg-blue-500' },
};

export function WorkSubmissionComponent() {
    const { address, isConnected, isCorrectNetwork, formatAddress } = useWallet();
    const workSubmission = useWorkSubmission();
    const token = usePINN44Token();

    const [bounties, setBounties] = useState<Bounty[]>([]);
    const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);

    // User state
    const [fileUri, setFileUri] = useState('');
    const [thumbnailUri, setThumbnailUri] = useState('');

    // Admin state
    const [isAdmin, setIsAdmin] = useState(false);
    const [isJudge, setIsJudge] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);

    // Create bounty form
    const [newBountyTitle, setNewBountyTitle] = useState('');
    const [newBountyDescription, setNewBountyDescription] = useState('');
    const [newBountyReward, setNewBountyReward] = useState('');
    const [newBountyStake, setNewBountyStake] = useState('0');
    const [newBountyDeadlineDays, setNewBountyDeadlineDays] = useState('7');

    // Loading states
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCreatingBounty, setIsCreatingBounty] = useState(false);
    const [isFunding, setIsFunding] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // File upload states
    const [isUploading, setIsUploading] = useState(false);
    const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<string | null>(null);

    // Check admin/judge roles
    const checkRoles = useCallback(async () => {
        if (!workSubmission.contract || !address) return;

        try {
            const [admin, judge] = await Promise.all([
                workSubmission.isAdmin(),
                workSubmission.isJudge()
            ]);
            setIsAdmin(admin);
            setIsJudge(judge);
        } catch (err) {
            // Fallback: check if connected wallet is the deployer (has admin by default)
            const deployerAddress = '0x9dEf30FF31Aeb50b44Ff46D1A11ad77d72E2455b';
            if (address.toLowerCase() === deployerAddress.toLowerCase()) {
                setIsAdmin(true);
                setIsJudge(true);
            }
        }
    }, [workSubmission, address]);

    // Fetch bounties
    const fetchBounties = useCallback(async () => {
        if (!workSubmission.contract) return;

        setIsLoading(true);
        try {
            const count = await workSubmission.getBountyCount();
            const bountyPromises = [];

            for (let i = 1; i <= Number(count); i++) {
                bountyPromises.push(workSubmission.getBounty(i));
            }

            const bountyData = await Promise.all(bountyPromises);
            const formattedBounties = bountyData
                .filter(b => b !== null)
                .map((b, index) => ({
                    id: index + 1,
                    title: b.title,
                    description: b.description,
                    rewardToken: b.rewardToken,
                    rewardAmount: b.rewardAmount,
                    deadline: b.deadline,
                    state: Number(b.state),
                    stakeRequired: b.stakeRequired,
                    stakeToken: b.stakeToken,
                    submissionCount: Number(b.submissionCount),
                    funded: b.funded,
                    creator: b.creator,
                }));

            setBounties(formattedBounties);
        } catch (err) {
            console.error('Failed to fetch bounties:', err);
        } finally {
            setIsLoading(false);
        }
    }, [workSubmission]);

    // Fetch submissions for a bounty
    const fetchSubmissions = useCallback(async (bountyId: number) => {
        if (!workSubmission.contract) return;

        try {
            const submissionIds = await workSubmission.getBountySubmissions(bountyId);
            const submissionPromises = submissionIds.map((id: bigint) =>
                workSubmission.getSubmission(Number(id))
            );

            const submissionData = await Promise.all(submissionPromises);
            const formattedSubmissions = submissionData
                .filter(s => s !== null)
                .map((s, index) => ({
                    id: Number(submissionIds[index]),
                    bountyId: Number(s.bountyId),
                    submitter: s.submitter,
                    fileUri: s.fileUri,
                    thumbnailUri: s.thumbnailUri,
                    status: Number(s.status),
                    stakeAmount: s.stakeAmount,
                }));

            setSubmissions(formattedSubmissions);
        } catch (err) {
            console.error('Failed to fetch submissions:', err);
        }
    }, [workSubmission]);

    useEffect(() => {
        if (isConnected && isCorrectNetwork) {
            fetchBounties();
            checkRoles();
        }
    }, [isConnected, isCorrectNetwork, fetchBounties, checkRoles]);

    useEffect(() => {
        if (selectedBounty) {
            fetchSubmissions(selectedBounty.id);
        }
    }, [selectedBounty, fetchSubmissions]);

    // Clear messages after 5 seconds
    useEffect(() => {
        if (successMessage || error) {
            const timer = setTimeout(() => {
                setSuccessMessage(null);
                setError(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, error]);

    // Admin: Create Bounty
    const handleCreateBounty = async () => {
        if (!newBountyTitle || !newBountyReward) return;

        setIsCreatingBounty(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const rewardAmount = ethers.parseEther(newBountyReward);
            const stakeAmount = ethers.parseEther(newBountyStake || '0');
            const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + (parseInt(newBountyDeadlineDays) * 86400));

            const receipt = await workSubmission.createBounty(
                newBountyTitle,
                newBountyDescription,
                CONTRACTS_CONFIG.PINN44_TOKEN,
                rewardAmount,
                stakeAmount,
                ethers.ZeroAddress, // Native MATIC for stake
                deadlineTimestamp
            );

            setTxHash(receipt.hash);
            setSuccessMessage('Bounty created successfully! Now fund it to activate.');

            // Reset form
            setNewBountyTitle('');
            setNewBountyDescription('');
            setNewBountyReward('');
            setNewBountyStake('0');
            setNewBountyDeadlineDays('7');

            await fetchBounties();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to create bounty';
            setError(message);
        } finally {
            setIsCreatingBounty(false);
        }
    };

    // Admin: Fund Bounty
    const handleFundBounty = async (bountyId: number, amount: bigint) => {
        setIsFunding(true);
        setError(null);

        try {
            // First approve tokens
            await token.approve(CONTRACTS_CONFIG.WORK_SUBMISSION, amount);

            // Then fund
            const receipt = await workSubmission.fundBounty(bountyId);
            setTxHash(receipt.hash);
            setSuccessMessage('Bounty funded successfully!');
            await fetchBounties();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fund bounty';
            setError(message);
        } finally {
            setIsFunding(false);
        }
    };

    // Admin: Start Judging
    const handleStartJudging = async (bountyId: number) => {
        setIsProcessing(true);
        setError(null);

        try {
            const receipt = await workSubmission.startJudging(bountyId);
            setTxHash(receipt.hash);
            setSuccessMessage('Bounty moved to judging phase!');
            await fetchBounties();
            if (selectedBounty?.id === bountyId) {
                setSelectedBounty({ ...selectedBounty, state: 1 });
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to start judging';
            setError(message);
        } finally {
            setIsProcessing(false);
        }
    };

    // Admin: Cancel Bounty
    const handleCancelBounty = async (bountyId: number) => {
        if (!confirm('Are you sure you want to cancel this bounty? Funds will be returned to the creator.')) return;

        setIsProcessing(true);
        setError(null);

        try {
            const receipt = await workSubmission.cancelBounty(bountyId);
            setTxHash(receipt.hash);
            setSuccessMessage('Bounty cancelled!');
            await fetchBounties();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to cancel bounty';
            setError(message);
        } finally {
            setIsProcessing(false);
        }
    };

    // Judge: Select Winner
    const handleSelectWinner = async (bountyId: number, submissionId: number) => {
        if (!confirm('Select this submission as the winner? This will transfer the reward.')) return;

        setIsProcessing(true);
        setError(null);

        try {
            const receipt = await workSubmission.selectWinner(bountyId, submissionId);
            setTxHash(receipt.hash);
            setSuccessMessage('Winner selected and rewarded!');
            await fetchBounties();
            await fetchSubmissions(bountyId);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to select winner';
            setError(message);
        } finally {
            setIsProcessing(false);
        }
    };

    // Judge: Reject Submission
    const handleRejectSubmission = async (submissionId: number, slashStake: boolean) => {
        const action = slashStake ? 'reject and SLASH stake' : 'reject (stake will be refunded)';
        if (!confirm(`Are you sure you want to ${action}?`)) return;

        setIsProcessing(true);
        setError(null);

        try {
            const receipt = await workSubmission.rejectSubmission(submissionId, slashStake);
            setTxHash(receipt.hash);
            setSuccessMessage('Submission rejected!');
            if (selectedBounty) {
                await fetchSubmissions(selectedBounty.id);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to reject submission';
            setError(message);
        } finally {
            setIsProcessing(false);
        }
    };

    // User: Submit work
    const handleSubmitWork = async () => {
        if (!selectedBounty || !fileUri) return;

        setIsSubmitting(true);
        setError(null);
        setTxHash(null);

        try {
            const stakeValue = selectedBounty.stakeRequired > BigInt(0) && selectedBounty.stakeToken === ethers.ZeroAddress
                ? selectedBounty.stakeRequired
                : BigInt(0);

            const receipt = await workSubmission.submitWork(
                selectedBounty.id,
                fileUri,
                thumbnailUri || '',
                stakeValue
            );

            setTxHash(receipt.hash);
            setSuccessMessage('Work submitted successfully!');
            setFileUri('');
            setThumbnailUri('');
            await fetchSubmissions(selectedBounty.id);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to submit work';
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDeadline = (timestamp: bigint) => {
        if (timestamp === BigInt(0)) return 'No deadline';
        const date = new Date(Number(timestamp) * 1000);
        return date.toLocaleDateString();
    };

    const isDeadlinePassed = (deadline: bigint) => {
        if (deadline === BigInt(0)) return false;
        return Date.now() / 1000 > Number(deadline);
    };

    // Handle file upload to IPFS (client-side direct upload to Pinata)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isThumbnail: boolean = false) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const setUploading = isThumbnail ? setIsUploadingThumbnail : setIsUploading;
        const setUri = isThumbnail ? setThumbnailUri : setFileUri;

        // Check file size (max 100MB)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            setError('File too large. Maximum size is 100MB.');
            return;
        }

        setUploading(true);
        setUploadProgress(`Preparing upload for ${file.name}...`);
        setError(null);

        try {
            // Step 1: Get temporary upload token from server
            setUploadProgress('Getting upload token...');
            const tokenResponse = await fetch('/api/upload/token');
            const tokenData = await tokenResponse.json();

            if (!tokenResponse.ok || !tokenData.jwt) {
                throw new Error(tokenData.error || 'Failed to get upload token');
            }

            // Step 2: Upload directly to Pinata from browser
            setUploadProgress(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`);

            const formData = new FormData();
            formData.append('file', file);

            // Add metadata
            const metadata = JSON.stringify({
                name: file.name,
                keyvalues: {
                    uploadedAt: new Date().toISOString(),
                    source: 'thebigpicture-bounties',
                }
            });
            formData.append('pinataMetadata', metadata);
            formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

            const uploadResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tokenData.jwt}`,
                },
                body: formData,
            });

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                console.error('Pinata upload error:', errorText);
                throw new Error('Failed to upload to IPFS');
            }

            const result = await uploadResponse.json();
            const cid = result.IpfsHash;

            if (!cid) {
                throw new Error('Failed to get CID from upload');
            }

            const ipfsUri = `ipfs://${cid}`;
            setUri(ipfsUri);
            setUploadProgress(`✓ Uploaded: ${ipfsUri.slice(0, 30)}...`);
            setSuccessMessage(`File uploaded to IPFS!`);

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to upload file';
            setError(message);
            setUploadProgress(null);
        } finally {
            setUploading(false);
            // Clear file input
            e.target.value = '';
        }
    };

    if (!CONTRACTS_CONFIG.WORK_SUBMISSION) {
        return (
            <Card className="border-yellow-500/50 bg-black/60">
                <CardHeader>
                    <CardTitle>Work Submission</CardTitle>
                    <CardDescription className="text-yellow-400">Contract not yet deployed</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (!isConnected || !isCorrectNetwork) {
        return (
            <Card className="border-gray-500/50 bg-black/60">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-400" />
                        Bounties & Work Submission
                    </CardTitle>
                    <CardDescription>Connect your wallet to Polygon to view bounties</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Admin Controls - Only visible to admins/judges */}
            {(isAdmin || isJudge) && (
                <div className="flex items-center gap-2 flex-wrap">
                    {isAdmin && (
                        <Badge className="bg-purple-600 hover:bg-purple-700">
                            <Shield className="w-3 h-3 mr-1" /> Admin
                        </Badge>
                    )}
                    {isJudge && !isAdmin && (
                        <Badge className="bg-yellow-600 hover:bg-yellow-700">
                            <Gavel className="w-3 h-3 mr-1" /> Judge
                        </Badge>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAdminPanel(!showAdminPanel)}
                        className="ml-auto"
                    >
                        {showAdminPanel ? 'Hide Admin Panel' : 'Show Admin Panel'}
                    </Button>
                </div>
            )}



            {/* Error / Success */}
            {error && (
                <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {successMessage && (
                <Alert className="bg-green-900/20 border-green-500/50">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <AlertTitle className="text-green-400">Success</AlertTitle>
                    <AlertDescription className="text-green-200">
                        {successMessage}
                        {txHash && (
                            <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer" className="ml-2 text-green-400 hover:underline">
                                View transaction <ExternalLink className="w-3 h-3 inline" />
                            </a>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            {/* Admin Panel - Only for admins */}
            {showAdminPanel && isAdmin && (
                <Card className="border-purple-500/50 bg-black/60 backdrop-blur-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="w-6 h-6 text-purple-400" />
                            Admin Panel
                        </CardTitle>
                        <CardDescription>Create and manage bounties</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="create">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="create">Create Bounty</TabsTrigger>
                                <TabsTrigger value="manage">Manage Bounties</TabsTrigger>
                            </TabsList>

                            <TabsContent value="create" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Title *</Label>
                                    <Input
                                        placeholder="e.g., Design a Community Logo"
                                        value={newBountyTitle}
                                        onChange={(e) => setNewBountyTitle(e.target.value)}
                                        className="bg-gray-900"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Textarea
                                        placeholder="Describe the task requirements..."
                                        value={newBountyDescription}
                                        onChange={(e) => setNewBountyDescription(e.target.value)}
                                        className="bg-gray-900 min-h-[100px]"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Reward (PINN44) *</Label>
                                        <Input
                                            type="number"
                                            placeholder="e.g., 500"
                                            value={newBountyReward}
                                            onChange={(e) => setNewBountyReward(e.target.value)}
                                            className="bg-gray-900"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Deadline (days from now)</Label>
                                        <Input
                                            type="number"
                                            placeholder="7"
                                            value={newBountyDeadlineDays}
                                            onChange={(e) => setNewBountyDeadlineDays(e.target.value)}
                                            className="bg-gray-900"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Required Stake (MATIC) - Anti-spam</Label>
                                    <Input
                                        type="number"
                                        placeholder="0 for no stake"
                                        value={newBountyStake}
                                        onChange={(e) => setNewBountyStake(e.target.value)}
                                        className="bg-gray-900"
                                    />
                                    <p className="text-xs text-gray-400">Set to 0 if no stake is required to submit</p>
                                </div>

                                <Button
                                    onClick={handleCreateBounty}
                                    disabled={isCreatingBounty || !newBountyTitle || !newBountyReward}
                                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                                >
                                    {isCreatingBounty ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create Bounty
                                        </>
                                    )}
                                </Button>
                            </TabsContent>

                            <TabsContent value="manage" className="space-y-4 mt-4">
                                {bounties.length === 0 ? (
                                    <p className="text-gray-400 text-center py-4">No bounties created yet</p>
                                ) : (
                                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                        {bounties.map((bounty) => (
                                            <div
                                                key={bounty.id}
                                                className="p-4 rounded-lg bg-gray-800/50 border border-gray-700"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h4 className="font-semibold text-white">{bounty.title}</h4>
                                                        <p className="text-sm text-gray-400">
                                                            {ethers.formatEther(bounty.rewardAmount)} PINN44 | {bounty.submissionCount} submissions
                                                        </p>
                                                    </div>
                                                    <Badge className={BountyState[bounty.state as keyof typeof BountyState]?.color || 'bg-gray-500'}>
                                                        {BountyState[bounty.state as keyof typeof BountyState]?.label || 'Unknown'}
                                                    </Badge>
                                                </div>

                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {/* Fund button */}
                                                    {!bounty.funded && bounty.state === 0 && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleFundBounty(bounty.id, bounty.rewardAmount)}
                                                            disabled={isFunding}
                                                            className="border-green-500/50 text-green-400 hover:bg-green-900/20"
                                                        >
                                                            <DollarSign className="w-3 h-3 mr-1" />
                                                            Fund
                                                        </Button>
                                                    )}

                                                    {/* Start Judging button */}
                                                    {bounty.state === 0 && bounty.funded && bounty.submissionCount > 0 && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleStartJudging(bounty.id)}
                                                            disabled={isProcessing}
                                                            className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-900/20"
                                                        >
                                                            <Gavel className="w-3 h-3 mr-1" />
                                                            Start Judging
                                                        </Button>
                                                    )}

                                                    {/* Cancel button */}
                                                    {(bounty.state === 0 || bounty.state === 1) && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleCancelBounty(bounty.id)}
                                                            disabled={isProcessing}
                                                            className="border-red-500/50 text-red-400 hover:bg-red-900/20"
                                                        >
                                                            <Ban className="w-3 h-3 mr-1" />
                                                            Cancel
                                                        </Button>
                                                    )}

                                                    {/* View Details */}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setSelectedBounty(bounty)}
                                                    >
                                                        View Details
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            )}

            {/* Selected Bounty Detail */}
            {selectedBounty && (
                <Card className="border-blue-500/50 bg-black/60 backdrop-blur-lg">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Award className="w-6 h-6 text-blue-400" />
                                    {selectedBounty.title}
                                </CardTitle>
                                <CardDescription>{selectedBounty.description}</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedBounty(null)}>
                                Back
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Bounty Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 rounded-lg bg-green-900/20 border border-green-500/20">
                                <p className="text-xs text-gray-400">Reward</p>
                                <p className="text-lg font-bold text-green-400">
                                    {ethers.formatEther(selectedBounty.rewardAmount)} PINN44
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-500/20">
                                <p className="text-xs text-gray-400">Submissions</p>
                                <p className="text-lg font-bold text-blue-400">{selectedBounty.submissionCount}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-purple-900/20 border border-purple-500/20">
                                <p className="text-xs text-gray-400">Deadline</p>
                                <p className="text-lg font-bold text-purple-400">{formatDeadline(selectedBounty.deadline)}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                                <p className="text-xs text-gray-400">Status</p>
                                <Badge className={BountyState[selectedBounty.state as keyof typeof BountyState]?.color || 'bg-gray-500'}>
                                    {BountyState[selectedBounty.state as keyof typeof BountyState]?.label || 'Unknown'}
                                </Badge>
                                {!selectedBounty.funded && selectedBounty.state === 0 && (
                                    <p className="text-xs text-yellow-400 mt-1">⚠️ Not funded</p>
                                )}
                            </div>
                        </div>

                        {/* Submit Work Form - Only for open bounties */}
                        {selectedBounty.state === 0 && selectedBounty.funded && !isDeadlinePassed(selectedBounty.deadline) && (
                            <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Upload className="w-4 h-4" />
                                    Submit Your Work
                                </h3>

                                {/* Upload Progress */}
                                {uploadProgress && (
                                    <div className="p-2 rounded bg-blue-900/30 text-blue-400 text-sm">
                                        {uploadProgress}
                                    </div>
                                )}

                                {/* Main File Upload */}
                                <div className="space-y-2">
                                    <Label>Work File *</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="ipfs://... or upload a file"
                                            value={fileUri}
                                            onChange={(e) => setFileUri(e.target.value)}
                                            className="bg-gray-900 flex-1"
                                        />
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => handleFileUpload(e, false)}
                                                disabled={isUploading}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={isUploading}
                                                className="border-blue-500/50 hover:bg-blue-900/20"
                                                asChild
                                            >
                                                <span>
                                                    {isUploading ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <><File className="h-4 w-4 mr-1" /> Upload</>
                                                    )}
                                                </span>
                                            </Button>
                                        </label>
                                    </div>
                                    <p className="text-xs text-gray-500">Upload your work file (images, documents, etc.) to IPFS</p>
                                </div>

                                {/* Thumbnail Upload */}
                                <div className="space-y-2">
                                    <Label>Thumbnail (optional)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="ipfs://... or upload an image"
                                            value={thumbnailUri}
                                            onChange={(e) => setThumbnailUri(e.target.value)}
                                            className="bg-gray-900 flex-1"
                                        />
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFileUpload(e, true)}
                                                disabled={isUploadingThumbnail}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={isUploadingThumbnail}
                                                className="border-purple-500/50 hover:bg-purple-900/20"
                                                asChild
                                            >
                                                <span>
                                                    {isUploadingThumbnail ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <><ImagePlus className="h-4 w-4 mr-1" /> Upload</>
                                                    )}
                                                </span>
                                            </Button>
                                        </label>
                                    </div>
                                    <p className="text-xs text-gray-500">Add a preview image for your submission</p>
                                </div>

                                {selectedBounty.stakeRequired > BigInt(0) && (
                                    <p className="text-sm text-yellow-400">
                                        ⚠️ This bounty requires a stake of {ethers.formatEther(selectedBounty.stakeRequired)}
                                        {selectedBounty.stakeToken === ethers.ZeroAddress ? ' MATIC' : ' tokens'}
                                    </p>
                                )}

                                <Button
                                    onClick={handleSubmitWork}
                                    disabled={isSubmitting || !fileUri || isUploading || isUploadingThumbnail}
                                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="mr-2 h-4 w-4" />
                                            Submit Work
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Submissions List */}
                        <div className="space-y-3">
                            <h3 className="font-semibold">Submissions ({submissions.filter(s => s.status !== 2).length})</h3>
                            {submissions.filter(s => s.status !== 2).length === 0 ? (
                                <p className="text-gray-400 text-sm">No submissions yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {submissions.filter(s => s.status !== 2).map((sub) => (
                                        <div
                                            key={sub.id}
                                            className={`p-3 rounded-lg border ${sub.status === 1
                                                ? 'bg-green-900/20 border-green-500/50'
                                                : sub.status === 2
                                                    ? 'bg-red-900/20 border-red-500/50'
                                                    : 'bg-gray-800/50 border-gray-700'
                                                }`}
                                        >
                                            <div className="flex gap-3">
                                                {/* Thumbnail Preview */}
                                                {sub.thumbnailUri && (
                                                    <a
                                                        href={sub.thumbnailUri.startsWith('ipfs://')
                                                            ? `https://gateway.pinata.cloud/ipfs/${sub.thumbnailUri.slice(7)}`
                                                            : sub.thumbnailUri}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="shrink-0"
                                                    >
                                                        <img
                                                            src={sub.thumbnailUri.startsWith('ipfs://')
                                                                ? `https://gateway.pinata.cloud/ipfs/${sub.thumbnailUri.slice(7)}`
                                                                : sub.thumbnailUri}
                                                            alt="Submission thumbnail"
                                                            className="w-16 h-16 object-cover rounded-lg border border-gray-600 hover:border-blue-400 transition-colors"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    </a>
                                                )}

                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center flex-wrap gap-2">
                                                        <div className="flex items-center gap-2">
                                                            {sub.thumbnailUri ? (
                                                                <Image className="w-4 h-4 text-gray-400" />
                                                            ) : (
                                                                <FileText className="w-4 h-4 text-gray-400" />
                                                            )}
                                                            <span className="text-sm font-mono">{formatAddress(sub.submitter)}</span>
                                                            <Badge className={SubmissionStatus[sub.status as keyof typeof SubmissionStatus]?.color || 'bg-gray-500'}>
                                                                {SubmissionStatus[sub.status as keyof typeof SubmissionStatus]?.label || 'Unknown'}
                                                            </Badge>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <a
                                                                href={sub.fileUri.startsWith('ipfs://')
                                                                    ? `https://gateway.pinata.cloud/ipfs/${sub.fileUri.slice(7)}`
                                                                    : sub.fileUri}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-400 hover:underline text-sm flex items-center gap-1"
                                                            >
                                                                View <ExternalLink className="w-3 h-3" />
                                                            </a>

                                                            {/* Judge Actions */}
                                                            {isJudge && sub.status === 0 && (selectedBounty.state === 0 || selectedBounty.state === 1) && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => handleSelectWinner(selectedBounty.id, sub.id)}
                                                                        disabled={isProcessing}
                                                                        className="text-green-400 hover:bg-green-900/20"
                                                                    >
                                                                        <Trophy className="w-3 h-3 mr-1" />
                                                                        Winner
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => handleRejectSubmission(sub.id, false)}
                                                                        disabled={isProcessing}
                                                                        className="text-red-400 hover:bg-red-900/20"
                                                                    >
                                                                        <Trash2 className="w-3 h-3 mr-1" />
                                                                        Remove
                                                                    </Button>
                                                                    {sub.stakeAmount > BigInt(0) && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => handleRejectSubmission(sub.id, true)}
                                                                            disabled={isProcessing}
                                                                            className="text-orange-400 hover:bg-orange-900/20"
                                                                            title="Reject and slash stake"
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </Button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Bounties List */}
            {!selectedBounty && (
                <Card className="border-blue-500/50 bg-black/60 backdrop-blur-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Award className="w-6 h-6 text-blue-400" />
                            Active Bounties
                        </CardTitle>
                        <CardDescription>Browse and submit work for active bounties</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-8">
                                <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-400" />
                                <p className="text-gray-400 mt-2">Loading bounties...</p>
                            </div>
                        ) : bounties.length === 0 ? (
                            <div className="text-center py-8">
                                <FileText className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                                <p className="text-gray-400">No bounties available yet</p>
                                {isAdmin && (
                                    <Button
                                        variant="outline"
                                        className="mt-4"
                                        onClick={() => setShowAdminPanel(true)}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create First Bounty
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {bounties.map((bounty) => (
                                    <div
                                        key={bounty.id}
                                        className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-blue-500/50 cursor-pointer transition-colors"
                                        onClick={() => setSelectedBounty(bounty)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-semibold text-white">{bounty.title}</h3>
                                                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{bounty.description}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <Badge className={BountyState[bounty.state as keyof typeof BountyState]?.color || 'bg-gray-500'}>
                                                    {BountyState[bounty.state as keyof typeof BountyState]?.label || 'Unknown'}
                                                </Badge>
                                                {!bounty.funded && bounty.state === 0 && (
                                                    <span className="text-xs text-yellow-400">Not funded</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-4 mt-3 text-sm">
                                            <span className="text-green-400">
                                                {ethers.formatEther(bounty.rewardAmount)} PINN44
                                            </span>
                                            <span className="text-gray-400 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatDeadline(bounty.deadline)}
                                            </span>
                                            <span className="text-gray-400">
                                                {bounty.submissionCount} submissions
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
