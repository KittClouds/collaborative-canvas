import { useEntityTheme } from "@/contexts/EntityThemeContext";
import { ENTITY_KINDS, EntityKind } from '@/lib/types/entityTypes';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export function EntityThemeTab() {
    const { theme, updateTheme, resetTheme, getVar } = useEntityTheme();

    // Group kinds for better layout? Or just list them.
    // Alphabetical sort might be nice.
    const sortedKinds = [...ENTITY_KINDS].sort();

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Entity Theme</h3>
                    <p className="text-sm text-muted-foreground">
                        Customize the colors used for entity highlighting and icons across the application.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={resetTheme}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset to Defaults
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedKinds.map((kind) => (
                    <div key={kind} className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                        <div
                            className="w-10 h-10 rounded-md shadow-sm border shrink-0"
                            style={{ backgroundColor: theme[kind] }} // We use the hex from state for the picker preview
                        />

                        <div className="flex-1 min-w-0">
                            <Label htmlFor={`color-${kind}`} className="text-sm font-medium mb-1 block truncate" title={kind}>
                                {kind}
                            </Label>
                            <div className="flex gap-2">
                                <div className="relative w-8 h-8 overflow-hidden rounded border cursor-pointer">
                                    <Input
                                        id={`color-${kind}`}
                                        type="color"
                                        value={theme[kind]}
                                        onChange={(e) => updateTheme(kind, e.target.value)}
                                        className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer"
                                    />
                                </div>
                                <Input
                                    value={theme[kind]}
                                    onChange={(e) => updateTheme(kind, e.target.value)}
                                    className="h-8 font-mono text-xs"
                                    maxLength={7}
                                />
                            </div>
                        </div>

                        {/* Preview Item */}
                        <div
                            className="px-2 py-1 rounded text-xs font-medium border"
                            style={{
                                // Direct CSS vars for preview to ensure it works
                                // But since this component is inside the provider, the global style tag works!
                                // We can just use the classes if they existed, or manual style with the var
                                backgroundColor: `hsl(${getVar(kind)} / 0.2)`,
                                color: `hsl(${getVar(kind)})`,
                                borderColor: `hsl(${getVar(kind)} / 0.3)`,
                            }}
                        >
                            Preview
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground mt-8">
                <p>
                    <strong>Note:</strong> These colors are applied globally to the Editor, File Tree, and Graph View.
                    Changes are saved to your local browser settings.
                </p>
            </div>
        </div>
    );
}
