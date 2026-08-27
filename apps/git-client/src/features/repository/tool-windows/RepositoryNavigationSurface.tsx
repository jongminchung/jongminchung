import { Button } from "@jongminchung/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { Icon } from "../../../components/Icon";
import type { ProductSettings } from "../../../domain/productSettings";

interface RepositoryNavigationSurfaceProps {
  readonly navigationStatus: string;
  readonly productSettings: ProductSettings;
}

export function RepositoryNavigationSurface({
  navigationStatus,
  productSettings,
}: RepositoryNavigationSurfaceProps) {
  if (
    productSettings.navigationBar !== "top" ||
    productSettings.presentationMode
  )
    return null;

  return (
    <nav
      aria-label="Navigation Bar"
      className={`topNavigationBar topNavigationBar [position:absolute] [top:30px] [right:30px] [left:31px] [z-index:var(--layer-navigation)] [display:flex] [height:26px] [align-items:center] [padding:0_8px] [background:var(--card)] [border-bottom:1px_solid_var(--border)] [html[data-presentation-mode=true]_&]:hidden!`}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={navigationStatus}
              className={cn("min-w-0 gap-1 text-[10px] text-muted-foreground")}
              variant="ghost"
              size="xs"
            >
              <Icon name="folder" size={12} />
              <span className="min-w-0 truncate">{navigationStatus}</span>
            </Button>
          }
        />
        <TooltipContent>{navigationStatus}</TooltipContent>
      </Tooltip>
    </nav>
  );
}
