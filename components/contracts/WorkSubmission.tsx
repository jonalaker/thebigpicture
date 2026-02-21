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
import { ConnectWalletBanner } from '@/components/ConnectWallet';

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
    0: { label: 'Open', color: 'bg-[#00897b]' },
    1: { label: 'Judging', color: 'bg-[#FFD700] text-[#121212]' },
    2: { label: 'Completed', color: 'bg-[#8247E5]' },
    3: { label: 'Cancelled', color: 'bg-red-500' },
};

const SubmissionStatus = {
    0: { label: 'Pending', color: 'bg-[#2a2a3e]' },
    1: { label: 'Winner', color: 'bg-[#FFD700] text-[#121212]' },
    2: { label: 'Rejected', color: 'bg-red-500' },
    3: { label: 'Refunded', color: 'bg-[#8247E5]' },
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

            // Log to off-chain Google Sheets ledger
            try {
                await fetch('/api/track-work', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        walletAddress: address,
                        taskId: `Bounty #${selectedBounty.id} - ${selectedBounty.title}`,
                        tokensEarned: ethers.formatEther(selectedBounty.rewardAmount)
                    })
                });
            } catch (err) {
                console.error('Failed to log to off-chain tracker', err);
            }

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
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const isDeadlinePassed = (deadline: bigint) => {
        if (deadline === BigInt(0)) return false;
        return Date.now() / 1000 > Number(deadline);
    };

    // Upload directly from browser to Lighthouse/IPFS — no server intermediary
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isThumbnail: boolean = false) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const setUploading = isThumbnail ? setIsUploadingThumbnail : setIsUploading;
        const setUri = isThumbnail ? setThumbnailUri : setFileUri;

        setUploading(true);
        setUploadProgress(`Preparing upload for ${file.name}...`);
        setError(null);

        const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);

        try {
            // Step 1: Get upload config from server (just the API key + URL)
            const configRes = await fetch('/api/upload');
            const config = await configRes.json();
            if (!configRes.ok) throw new Error(config.error || 'Failed to get upload config');

            // Check file size limit
            if (file.size > config.maxFileSize) {
                const maxMB = Math.round(config.maxFileSize / 1024 / 1024);
                throw new Error(`File too large. Maximum size is ${maxMB}MB with ${config.provider}.`);
            }

            // Step 2: Upload directly from browser to IPFS provider
            const cid = await new Promise<string>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const formData = new FormData();
                formData.append('file', file);

                // Pinata needs extra metadata
                if (config.provider === 'pinata') {
                    formData.append('pinataMetadata', JSON.stringify({
                        name: file.name,
                        keyvalues: { uploadedAt: new Date().toISOString(), source: 'thebigpicture' }
                    }));
                    formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
                }

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percent = Math.round((event.loaded / event.total) * 100);
                        const loadedMB = (event.loaded / 1024 / 1024).toFixed(1);
                        setUploadProgress(`Uploading ${file.name}... ${percent}% (${loadedMB}/${fileSizeMB} MB)`);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const result = JSON.parse(xhr.responseText);
                            // Lighthouse returns { Hash }, Pinata returns { IpfsHash }
                            const hash = result.Hash || result.IpfsHash;
                            if (hash) {
                                resolve(hash);
                            } else {
                                reject(new Error('No IPFS hash returned'));
                            }
                        } catch {
                            reject(new Error('Invalid response from IPFS provider'));
                        }
                    } else {
                        reject(new Error(`Upload failed (${xhr.status}). Try again.`));
                    }
                };

                xhr.onerror = () => reject(new Error('Network error. Check your connection and try again.'));
                xhr.timeout = 0; // No timeout for large files

                xhr.open('POST', config.uploadUrl);

                // Set auth headers
                if (config.provider === 'lighthouse') {
                    xhr.setRequestHeader('Authorization', `Bearer ${config.apiKey}`);
                } else if (config.provider === 'pinata') {
                    xhr.setRequestHeader('pinata_api_key', config.apiKey);
                    xhr.setRequestHeader('pinata_secret_api_key', config.secretKey);
                }

                xhr.send(formData);
            });

            const ipfsUri = `ipfs://${cid}`;
            setUri(ipfsUri);
            setUploadProgress(`✓ File accepted! Complete upload using Submit Work button below`);
            setSuccessMessage(`File accepted! (${fileSizeMB} MB) — Use the Submit Work button to finish.`);

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Upload failed';
            console.error('Upload failed:', message);
            setError(message);
            setUploadProgress(null);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    if (!CONTRACTS_CONFIG.WORK_SUBMISSION) {
        return (
            <Card className="border-[#FFD700]/30 bg-[#1a1a2e]/80">
                <CardHeader>
                    <CardTitle>Work Submission</CardTitle>
                    <CardDescription className="text-[#FFD700]">Contract not yet deployed</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (!isConnected || !isCorrectNetwork) {
        return (
            <Card className="border-[#2a2a3e] bg-[#1a1a2e]/80">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-6 h-6 text-[#8247E5]" />
                        Submit Work
                    </CardTitle>
                    <CardDescription>Connect your wallet to Polygon to submit work</CardDescription>
                </CardHeader>
                <CardContent>
                    <ConnectWalletBanner />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Admin Controls - Only visible to admins/judges */}
            {(isAdmin || isJudge) && (
                <div className="flex items-center gap-2 flex-wrap">
                    {isAdmin && (
                        <Badge className="bg-[#8247E5] hover:bg-[#5b2bba]">
                            <Shield className="w-3 h-3 mr-1" /> Admin
                        </Badge>
                    )}
                    {isJudge && !isAdmin && (
                        <Badge className="bg-[#FFD700]/80 hover:bg-[#FFD700] text-[#121212]">
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
                <Alert className="bg-[#004d40]/20 border-[#00897b]/50">
                    <CheckCircle2 className="h-4 w-4 text-[#00897b]" />
                    <AlertTitle className="text-[#00897b]">Success</AlertTitle>
                    <AlertDescription className="text-foreground/60">
                        {successMessage}
                        {txHash && (
                            <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer" className="ml-2 text-[#FFD700] hover:underline">
                                View transaction <ExternalLink className="w-3 h-3 inline" />
                            </a>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            {/* Admin Panel - Only for admins */}
            {showAdminPanel && isAdmin && (
                <Card className="border-[#8247E5]/30 bg-[#1a1a2e]/80 backdrop-blur-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="w-6 h-6 text-[#8247E5]" />
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
                                        className="bg-[#1a1a2e]"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Textarea
                                        placeholder="Describe the task requirements..."
                                        value={newBountyDescription}
                                        onChange={(e) => setNewBountyDescription(e.target.value)}
                                        className="bg-[#1a1a2e] min-h-[100px]"
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
                                            className="bg-[#1a1a2e]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Deadline (days from now)</Label>
                                        <Input
                                            type="number"
                                            placeholder="7"
                                            value={newBountyDeadlineDays}
                                            onChange={(e) => setNewBountyDeadlineDays(e.target.value)}
                                            className="bg-[#1a1a2e]"
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
                                        className="bg-[#1a1a2e]"
                                    />
                                    <p className="text-xs text-foreground/40">Set to 0 if no stake is required to submit</p>
                                </div>

                                <Button
                                    onClick={handleCreateBounty}
                                    disabled={isCreatingBounty || !newBountyTitle || !newBountyReward}
                                    className="w-full btn-gold"
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
                                    <p className="text-foreground/50 text-center py-4">No bounties created yet</p>
                                ) : (
                                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                        {bounties.map((bounty) => (
                                            <div
                                                key={bounty.id}
                                                className="p-4 rounded-lg bg-[#1a1a2e] border border-[#2a2a3e]"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h4 className="font-semibold text-foreground">{bounty.title}</h4>
                                                        <p className="text-sm text-foreground/50">
                                                            {ethers.formatEther(bounty.rewardAmount)} PINN44 | {bounty.submissionCount} submissions
                                                        </p>
                                                    </div>
                                                    <Badge className={BountyState[bounty.state as keyof typeof BountyState]?.color || 'bg-[#2a2a3e]'}>
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
                                                            className="border-[#FFD700]/50 text-[#FFD700] hover:bg-[#FFD700]/10"
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
                                                            className="border-[#FFD700]/50 text-[#FFD700] hover:bg-[#FFD700]/10"
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
                <Card className="border-[#8247E5]/30 bg-[#1a1a2e]/80 backdrop-blur-lg">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Award className="w-6 h-6 text-[#FFD700]" />
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
                            <div className="p-3 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/20">
                                <p className="text-xs text-foreground/50">Reward</p>
                                <p className="text-lg font-bold text-[#FFD700]">
                                    {ethers.formatEther(selectedBounty.rewardAmount)} PINN44
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-[#8247E5]/10 border border-[#8247E5]/20">
                                <p className="text-xs text-foreground/50">Submissions</p>
                                <p className="text-lg font-bold text-[#8247E5]">{selectedBounty.submissionCount}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-[#8247E5]/5 border border-[#8247E5]/20">
                                <p className="text-xs text-foreground/50">Deadline</p>
                                <p className="text-lg font-bold text-[#a855f7]">{formatDeadline(selectedBounty.deadline)}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-[#1a1a2e] border border-[#2a2a3e]">
                                <p className="text-xs text-foreground/50">Status</p>
                                <Badge className={BountyState[selectedBounty.state as keyof typeof BountyState]?.color || 'bg-[#2a2a3e]'}>
                                    {BountyState[selectedBounty.state as keyof typeof BountyState]?.label || 'Unknown'}
                                </Badge>
                                {!selectedBounty.funded && selectedBounty.state === 0 && (
                                    <p className="text-xs text-[#FFD700] mt-1">⚠️ Not funded</p>
                                )}
                            </div>
                        </div>

                        {/* Submit Work Form - Only for open bounties */}
                        {selectedBounty.state === 0 && selectedBounty.funded && !isDeadlinePassed(selectedBounty.deadline) && (
                            <div className="p-4 rounded-lg bg-[#1a1a2e] border border-[#2a2a3e] space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Upload className="w-4 h-4" />
                                    Submit Your Work
                                </h3>

                                {/* Upload Progress */}
                                {uploadProgress && (
                                    <div className="p-2 rounded bg-[#8247E5]/10 text-[#8247E5] text-sm">
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
                                            className="bg-[#1a1a2e] flex-1"
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
                                                className="border-[#8247E5]/50 hover:bg-[#8247E5]/10"
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
                                    <p className="text-xs text-foreground/40">Upload your work file (images, documents, etc.) to IPFS</p>
                                </div>

                                {/* Thumbnail Upload */}
                                <div className="space-y-2">
                                    <Label>Thumbnail (optional)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="ipfs://... or upload an image"
                                            value={thumbnailUri}
                                            onChange={(e) => setThumbnailUri(e.target.value)}
                                            className="bg-[#1a1a2e] flex-1"
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
                                                className="border-[#8247E5]/50 hover:bg-[#8247E5]/10"
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
                                    <p className="text-xs text-foreground/40">Add a preview image for your submission</p>
                                </div>

                                {selectedBounty.stakeRequired > BigInt(0) && (
                                    <p className="text-sm text-[#FFD700]">
                                        ⚠️ This bounty requires a stake of {ethers.formatEther(selectedBounty.stakeRequired)}
                                        {selectedBounty.stakeToken === ethers.ZeroAddress ? ' MATIC' : ' tokens'}
                                    </p>
                                )}

                                <Button
                                    onClick={handleSubmitWork}
                                    disabled={isSubmitting || !fileUri || isUploading || isUploadingThumbnail}
                                    className="w-full btn-gold"
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
                                <p className="text-foreground/50 text-sm">No submissions yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {submissions.filter(s => s.status !== 2).map((sub) => (
                                        <div
                                            key={sub.id}
                                            className={`p-3 rounded-lg border ${sub.status === 1
                                                ? 'bg-[#004d40]/20 border-[#00897b]/50'
                                                : sub.status === 2
                                                    ? 'bg-red-900/20 border-red-500/50'
                                                    : 'bg-[#1a1a2e] border-[#2a2a3e]'
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
                                                            className="w-16 h-16 object-cover rounded-lg border border-[#2a2a3e] hover:border-[#8247E5] transition-colors"
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
                                                                <Image className="w-4 h-4 text-foreground/40" />
                                                            ) : (
                                                                <FileText className="w-4 h-4 text-foreground/40" />
                                                            )}
                                                            <span className="text-sm font-mono">{formatAddress(sub.submitter)}</span>
                                                            <Badge className={SubmissionStatus[sub.status as keyof typeof SubmissionStatus]?.color || 'bg-[#2a2a3e]'}>
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
                                                                className="text-[#FFD700] hover:underline text-sm flex items-center gap-1"
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
                                                                        className="text-[#FFD700] hover:bg-[#FFD700]/10"
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
                                                                            className="text-destructive hover:bg-destructive/10"
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
                <Card className="border-[#8247E5]/30 bg-[#1a1a2e]/80 backdrop-blur-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Award className="w-6 h-6 text-[#FFD700]" />
                            Active Bounties
                        </CardTitle>
                        <CardDescription>Browse and submit work for active bounties</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-8">
                                <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#8247E5]" />
                                <p className="text-foreground/50 mt-2">Loading bounties...</p>
                            </div>
                        ) : bounties.length === 0 ? (
                            <div className="text-center py-8">
                                <FileText className="w-12 h-12 mx-auto text-foreground/20 mb-4" />
                                <p className="text-foreground/50">No bounties available yet</p>
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
                                        className="p-4 rounded-lg bg-[#1a1a2e] border border-[#2a2a3e] hover:border-[#8247E5]/50 cursor-pointer transition-colors"
                                        onClick={() => setSelectedBounty(bounty)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-semibold text-foreground">{bounty.title}</h3>
                                                <p className="text-sm text-foreground/50 mt-1 line-clamp-2">{bounty.description}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <Badge className={BountyState[bounty.state as keyof typeof BountyState]?.color || 'bg-[#2a2a3e]'}>
                                                    {BountyState[bounty.state as keyof typeof BountyState]?.label || 'Unknown'}
                                                </Badge>
                                                {!bounty.funded && bounty.state === 0 && (
                                                    <span className="text-xs text-[#FFD700]">Not funded</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-4 mt-3 text-sm">
                                            <span className="text-[#FFD700]">
                                                {ethers.formatEther(bounty.rewardAmount)} PINN44
                                            </span>
                                            <span className="text-foreground/50 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatDeadline(bounty.deadline)}
                                            </span>
                                            <span className="text-foreground/50">
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
