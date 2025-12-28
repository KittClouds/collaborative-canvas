import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Boxes, Network, Settings, PanelRightClose, PanelRightOpen, Type } from "lucide-react";
import { useBlueprintHub } from "@/features/blueprint-hub/hooks/useBlueprintHub";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SettingsDropdownProps {
    toolbarVisible: boolean;
    onToolbarToggle: (visible: boolean) => void;
    schemaManagerTrigger: React.ReactNode;
}

export function SettingsDropdown({
    toolbarVisible,
    onToolbarToggle,
    schemaManagerTrigger
}: SettingsDropdownProps) {
    const { toggleHub, isHubOpen } = useBlueprintHub();
    const navigate = useNavigate();
    const location = useLocation();
    const isGraphPage = location.pathname === '/graph';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <Settings className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                    onClick={() => navigate('/graph')}
                    className={cn("gap-2", isGraphPage && "bg-accent/50")}
                >
                    <Network className="h-4 w-4" />
                    <span>Graph Explorer</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={toggleHub}
                    className={cn("gap-2", isHubOpen && "bg-accent/50")}
                >
                    <Boxes className="h-4 w-4" />
                    <span>Blueprint Hub</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => onToolbarToggle(!toolbarVisible)} className="gap-2">
                    <Type className="h-4 w-4" />
                    <span>{toolbarVisible ? "Hide Toolbar" : "Show Toolbar"}</span>
                </DropdownMenuItem>

                {/* We can't easily wrap the DialogTrigger from SchemaManager here without rendering it. 
            So we might need to pass the trigger or rethink SchemaManager.
            Actually, SchemaManager renders a Dialog with a Trigger. 
            If we put that Trigger in a DropdownMenuItem, we need to stop propagation.
        */}
                <div className="p-1">
                    {/* This isn't ideal for a dropdown item. 
                 Better pattern: SchemaManager should expose a way to control open state, or we just render it outside 
                 or we just put the button in the dropdown but prevent menu close?
                 For now, let's just keep SchemaManager in the header as it is complex?
                 The user said "cleaner... settings menu".
                 Maybe SchemaManager stays in the header as a primary tool? 
                 Or maybe we just create a "Schema" menu item that opens it?
                 Let's stick to cleaning up the "Graph" and "Blueprint" buttons first.
             */}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
