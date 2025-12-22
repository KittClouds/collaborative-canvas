import { useState, useEffect } from "react"
import { EntityRegistry } from "@/lib/entities/entity-registry"
import { registryStorage } from "@/lib/storage/entityStorage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Archive, Database, Trash2, RefreshCcw, Save, Check } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface RegistrySettingsProps {
    registry: EntityRegistry
}

export function RegistrySettings({ registry }: RegistrySettingsProps) {
    const [stats, setStats] = useState(registry.getGlobalStats())
    const [showFlushConfirm, setShowFlushConfirm] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [backups, setBackups] = useState<any[]>([])
    const [isCreatingBackup, setIsCreatingBackup] = useState(false)
    const [integrityReport, setIntegrityReport] = useState<{ valid: boolean, issues: any[] } | null>(null)
    const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false)

    useEffect(() => {
        loadBackups()
    }, [])

    const loadBackups = async () => {
        try {
            const list = await registryStorage.listBackups()
            setBackups(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))
        } catch (error) {
            console.error("Failed to load backups", error)
        }
    }

    const handleCreateBackup = async () => {
        setIsCreatingBackup(true)
        try {
            const backup = registry.createBackup()
            await registryStorage.saveBackup(backup)
            toast.success(`Backup created: ${backup.id}`)
            loadBackups()
        } catch (error) {
            console.error(error)
            toast.error("Failed to create backup")
        } finally {
            setIsCreatingBackup(false)
        }
    }

    const handleRestoreBackup = async (backup: any) => {
        try {
            registry.restoreFromBackup(backup.data, { confirmOverwrite: true })
            setStats(registry.getGlobalStats())
            toast.success(`Registry restored from ${new Date(backup.timestamp).toLocaleString()}`)
            await registryStorage.saveRegistry(registry) // Persist the restored state
        } catch (error) {
            console.error(error)
            toast.error("Failed to restore backup")
        }
    }

    const handleDeleteBackup = async (id: string) => {
        try {
            await registryStorage.deleteBackup(id)
            toast.success("Backup deleted")
            loadBackups()
        } catch (error) {
            console.error(error)
            toast.error("Failed to delete backup")
        }
    }

    const handleCheckIntegrity = () => {
        setIsCheckingIntegrity(true)
        try {
            const report = registry.checkIntegrity()
            setIntegrityReport(report)
            if (report.valid) {
                toast.success("Integrity check passed: No issues found")
            } else {
                toast.warning(`Integrity check found ${report.issues.length} issues`)
            }
        } catch (error) {
            console.error(error)
            toast.error("Integrity check failed")
        } finally {
            setIsCheckingIntegrity(false)
        }
    }

    const handleRepairIntegrity = async () => {
        try {
            const result = registry.repairIntegrity()
            toast.success(`Integrity repair complete: fixed ${result.fixed} issues.`)
            setIntegrityReport(null) // Clear report after repair
            setStats(registry.getGlobalStats())
            await registryStorage.saveRegistry(registry)
        } catch (error) {
            console.error(error)
            toast.error("Integrity repair failed")
        }
    }

    useEffect(() => {
        const interval = setInterval(() => {
            setStats(registry.getGlobalStats())
        }, 2000)
        return () => clearInterval(interval)
    }, [registry])

    const handleManualSave = async () => {
        setIsSaving(true)
        try {
            await registryStorage.saveRegistry(registry)
            toast.success("Registry saved to database")
        } catch (error) {
            console.error("Failed to save registry", error)
            toast.error("Failed to save registry")
        } finally {
            setIsSaving(false)
        }
    }

    const handleFlush = async (options: { createBackup: boolean }) => {
        try {
            const result = await registry.flushRegistry({
                userConfirmed: true,
                reason: "User manual flush via Settings",
                createBackup: options.createBackup
            })
            if (result.backupCreated) {
                // The registry.flushRegistry already called createBackup internally if requested
                // but we need to SAVE it to the storageService too
                const backup = registry.createBackup(); // This is a bit redundant if result returned it, but let's be sure
                // Actually result.backupCreated is just ID. 
                // Let's rely on the internal logic or just save the result if it returned full backup
            }
            // Better: if options.createBackup was true, the registry.flush already made it.
            // But registry doesn't know about storageService.
            // So we should do it here.
            if (options.createBackup) {
                const backup = registry.createBackup();
                await registryStorage.saveBackup(backup);
                loadBackups();
            }

            setStats(registry.getGlobalStats())
            setShowFlushConfirm(false)
            toast.success(options.createBackup ? "Registry flushed (backup created)" : "Registry flushed")
            // Also clear generic storage if needed, but registryStorage handles sync mostly
            await registryStorage.saveRegistry(registry) // Save empty state
        } catch (error) {
            console.error(error)
            toast.error("Failed to flush registry")
        }
    }

    // Placeholder for backup list...

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Entities</CardTitle>
                        <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalEntities}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Relationships</CardTitle>
                        <RefreshCcw className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalRelationships}</div>
                    </CardContent>
                </Card>
                {/* More stats cards... */}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Save className="mr-2 h-5 w-5 text-green-500" />
                        Persistence
                    </CardTitle>
                    <CardDescription>Manually sync the registry state with storage.</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                    <Button variant="outline" onClick={handleManualSave} disabled={isSaving}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSaving ? "Saving..." : "Save Now"}
                    </Button>
                    <Button variant="outline" onClick={() => {
                        const data = registry.toJSON();
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `inklings-registry-${new Date().toISOString().split('T')[0]}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("Registry exported for download");
                    }}>
                        <Archive className="mr-2 h-4 w-4" />
                        Export JSON
                    </Button>
                    <label className="cursor-pointer">
                        <Input
                            type="file"
                            className="hidden"
                            accept=".json"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                    const text = await file.text();
                                    const data = JSON.parse(text);
                                    const stats = registry.importRegistry(data, 'merge');
                                    toast.success(`Imported ${stats.imported} entities (${stats.skipped} skipped)`);
                                    setStats(registry.getGlobalStats());
                                    await registryStorage.saveRegistry(registry);
                                } catch (err) {
                                    console.error(err);
                                    toast.error("Failed to import registry file");
                                }
                            }}
                        />
                        <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Import JSON
                        </div>
                    </label>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <AlertCircle className="mr-2 h-5 w-5 text-orange-500" />
                        Integrity Check
                    </CardTitle>
                    <CardDescription>Scan for orphaned data and broken references.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleCheckIntegrity} disabled={isCheckingIntegrity}>
                            <RefreshCcw className={cn("mr-2 h-4 w-4", isCheckingIntegrity && "animate-spin")} />
                            {isCheckingIntegrity ? "Checking..." : "Run Integrity Check"}
                        </Button>
                        {integrityReport && !integrityReport.valid && (
                            <Button variant="default" onClick={handleRepairIntegrity}>
                                Repair All Issues
                            </Button>
                        )}
                    </div>

                    {integrityReport && (
                        <div className="mt-4 space-y-2">
                            {integrityReport.valid ? (
                                <Alert className="bg-green-50 text-green-800 border-green-200">
                                    <Check className="h-4 w-4" />
                                    <AlertTitle>Success</AlertTitle>
                                    <AlertDescription>No integrity issues detected.</AlertDescription>
                                </Alert>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-orange-700">Found {integrityReport.issues.length} issues:</p>
                                    <div className="max-h-[200px] overflow-auto border rounded divide-y bg-muted/30">
                                        {integrityReport.issues.map((issue, i) => (
                                            <div key={i} className="p-2 text-xs flex gap-2 items-start">
                                                <AlertCircle className={cn("h-3 w-3 mt-0.5", issue.severity === 'error' ? 'text-red-500' : 'text-orange-500')} />
                                                <span>{issue.description}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center text-red-600">
                        <Trash2 className="mr-2 h-5 w-5" />
                        Danger Zone
                    </CardTitle>
                    <CardDescription>Destructive operations that cannot be undone.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="destructive" onClick={() => setShowFlushConfirm(true)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Flush Entire Registry
                    </Button>
                </CardContent>
            </Card>


            {showFlushConfirm && (
                <FlushConfirmationDialog
                    onConfirm={handleFlush}
                    onCancel={() => setShowFlushConfirm(false)}
                    stats={stats}
                />
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Archive className="mr-2 h-5 w-5 text-blue-500" />
                        Backups
                    </CardTitle>
                    <CardDescription>Manage registry snapshots and historical data.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button variant="outline" onClick={handleCreateBackup} disabled={isCreatingBackup}>
                        <Archive className="mr-2 h-4 w-4" />
                        {isCreatingBackup ? "Creating..." : "Create Backup Now"}
                    </Button>

                    <div className="border rounded-lg divide-y bg-card/50">
                        {backups.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                No backups found.
                            </div>
                        ) : (
                            backups.map((backup) => (
                                <div key={backup.id} className="p-4 flex items-center justify-between hover:bg-accent/5 transition-colors">
                                    <div className="space-y-1">
                                        <p className="font-medium text-sm">
                                            {new Date(backup.timestamp).toLocaleString()}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {backup.stats.totalEntities} entities, {backup.stats.totalRelationships} relationships
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                            onClick={() => handleRestoreBackup(backup)}
                                        >
                                            Restore
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleDeleteBackup(backup.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function FlushConfirmationDialog({ onConfirm, onCancel, stats }: {
    onConfirm: (opts: { createBackup: boolean }) => void,
    onCancel: () => void,
    stats: any
}) {
    const [confirmText, setConfirmText] = useState('')
    const [createBackup, setCreateBackup] = useState(true)

    return (
        <Dialog open onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-red-600 flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        Flush Entity Registry
                    </DialogTitle>
                    <DialogDescription>
                        This action cannot be undone unless a backup is created.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Warning</AlertTitle>
                        <AlertDescription>
                            This will permanently delete:
                            <ul className="mt-2 list-disc pl-5 text-xs">
                                <li>{stats.totalEntities} entities</li>
                                <li>{stats.totalRelationships} relationships</li>
                                <li>{stats.totalCoOccurrences} co-occurrences</li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="backup"
                            checked={createBackup}
                            onCheckedChange={(c) => setCreateBackup(!!c)}
                        />
                        <Label htmlFor="backup">Create backup before flush</Label>
                    </div>

                    <div className="space-y-2">
                        <Label>Type "FLUSH" to confirm</Label>
                        <Input
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="FLUSH"
                            className="border-red-300 focus-visible:ring-red-500"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button
                        variant="destructive"
                        disabled={confirmText !== 'FLUSH'}
                        onClick={() => onConfirm({ createBackup })}
                    >
                        Flush Registry
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
