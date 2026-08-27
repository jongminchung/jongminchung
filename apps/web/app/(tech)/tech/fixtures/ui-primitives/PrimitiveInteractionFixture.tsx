"use client";

import { Button } from "@jongminchung/ui/components/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@jongminchung/ui/components/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@jongminchung/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@jongminchung/ui/components/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jongminchung/ui/components/select";
import { useState } from "react";

/** 공용 primitive의 keyboard·focus browser 계약만 렌더링함 */
export function PrimitiveInteractionFixture(): React.JSX.Element {
  const [commandResult, setCommandResult] = useState("No command selected");

  return (
    <main className="mx-auto grid min-h-screen max-w-2xl content-start gap-8 p-8">
      <h1 className="text-2xl font-semibold">Shared UI interaction fixture</h1>

      <section className="grid gap-3" aria-labelledby="dialog-fixture-title">
        <h2 id="dialog-fixture-title" className="text-lg font-medium">
          Dialog
        </h2>
        <Dialog>
          <DialogTrigger render={<Button className="w-fit" />}>
            Open dialog
          </DialogTrigger>
          <DialogContent closeLabel="Close dialog">
            <DialogHeader>
              <DialogTitle>Shared dialog</DialogTitle>
              <DialogDescription>
                Verifies dismissal and trigger focus restoration
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </section>

      <section className="grid gap-3" aria-labelledby="select-fixture-title">
        <h2 id="select-fixture-title" className="text-lg font-medium">
          Select
        </h2>
        <Select defaultValue="alpha">
          <SelectTrigger aria-label="Fixture branch">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alpha">Alpha</SelectItem>
            <SelectItem value="beta">Beta</SelectItem>
            <SelectItem value="gamma">Gamma</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <section className="grid gap-3" aria-labelledby="menu-fixture-title">
        <h2 id="menu-fixture-title" className="text-lg font-medium">
          Menu
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="w-fit" />}>
            Open actions
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Open repository</DropdownMenuItem>
            <DropdownMenuItem>Clone repository</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </section>

      <section className="grid gap-3" aria-labelledby="command-fixture-title">
        <h2 id="command-fixture-title" className="text-lg font-medium">
          Command
        </h2>
        <Command label="Filter commands" className="h-52 border">
          <CommandInput />
          <CommandList>
            <CommandItem
              value="open-repository"
              onSelect={() => setCommandResult("Selected: Open repository")}
            >
              Open repository
            </CommandItem>
            <CommandItem
              value="clone-repository"
              onSelect={() => setCommandResult("Selected: Clone repository")}
            >
              Clone repository
            </CommandItem>
          </CommandList>
        </Command>
        <p role="status">{commandResult}</p>
      </section>
    </main>
  );
}
