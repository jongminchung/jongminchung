import type * as React from "react";
import { cn } from "../../lib/utils.js";

type CardProps = React.ComponentProps<"div">;
type CardHeaderProps = React.ComponentProps<"div">;
type CardTitleProps = React.ComponentProps<"h3">;
type CardDescriptionProps = React.ComponentProps<"p">;
type CardContentProps = React.ComponentProps<"div">;
type CardFooterProps = React.ComponentProps<"div">;

function Card({ className, ...props }: CardProps): React.ReactElement {
  return (
    <div
      className={cn("rounded-md border border-hairline bg-canvas-elevated text-ink", className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: CardHeaderProps): React.ReactElement {
  return <div className={cn("flex flex-col gap-2 p-6", className)} {...props} />;
}

function CardTitle({ className, ...props }: CardTitleProps): React.ReactElement {
  return <h3 className={cn("ds-heading-md", className)} {...props} />;
}

function CardDescription({ className, ...props }: CardDescriptionProps): React.ReactElement {
  return <p className={cn("ds-body-md text-body", className)} {...props} />;
}

function CardContent({ className, ...props }: CardContentProps): React.ReactElement {
  return <div className={cn("px-6 pb-6", className)} {...props} />;
}

function CardFooter({ className, ...props }: CardFooterProps): React.ReactElement {
  return <div className={cn("flex items-center px-6 pb-6", className)} {...props} />;
}

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  type CardContentProps,
  type CardDescriptionProps,
  type CardFooterProps,
  type CardHeaderProps,
  type CardProps,
  type CardTitleProps,
};
