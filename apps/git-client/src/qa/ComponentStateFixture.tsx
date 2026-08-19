import { Button } from "@jongminchung/ui/components/button";
import { Checkbox } from "@jongminchung/ui/components/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@jongminchung/ui/components/dialog";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@jongminchung/ui/components/empty";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@jongminchung/ui/components/field";
import { Input } from "@jongminchung/ui/components/input";
import { Spinner } from "@jongminchung/ui/components/spinner";
import { AppearanceProvider } from "../components/AppearanceProvider";
import { GitClientTheme } from "../components/GitClientTheme";

function StateGroup({
    children,
    title,
}: {
    readonly children: React.ReactNode;
    readonly title: string;
}) {
    return (
        <section className="grid content-start gap-3 rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">{title}</h2>
            {children}
        </section>
    );
}

export default function ComponentStateFixture() {
    return (
        <AppearanceProvider>
            <GitClientTheme>
                <main className="h-full overflow-auto bg-background p-6 text-foreground">
                    <header className="mb-6">
                        <h1 className="text-xl font-semibold">
                            Component state fixture
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Deterministic development-only component states
                        </p>
                    </header>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
                        <StateGroup title="Actions">
                            <div className="flex flex-wrap gap-2">
                                <Button>Primary</Button>
                                <Button variant="secondary">Secondary</Button>
                                <Button variant="outline">Outline</Button>
                                <Button variant="destructive">
                                    Destructive
                                </Button>
                                <Button disabled>Disabled</Button>
                                <Button disabled>
                                    <Spinner aria-hidden /> Busy
                                </Button>
                            </div>
                        </StateGroup>
                        <StateGroup title="Fields">
                            <Field>
                                <FieldLabel htmlFor="fixture-name">
                                    Repository name
                                </FieldLabel>
                                <FieldDescription>
                                    Required deterministic field
                                </FieldDescription>
                                <Input
                                    aria-invalid
                                    id="fixture-name"
                                    readOnly
                                    value="invalid repository"
                                />
                                <FieldError>
                                    Use an owner/repository value
                                </FieldError>
                            </Field>
                            <div className="flex flex-wrap gap-4">
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox defaultChecked /> Selected
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox /> Unselected
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox disabled /> Disabled
                                </label>
                            </div>
                        </StateGroup>
                        <StateGroup title="Empty and loading">
                            <Empty className="min-h-36 border">
                                <EmptyHeader>
                                    <EmptyTitle>No change requests</EmptyTitle>
                                    <EmptyDescription>
                                        Connect an account or change the filter
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                            <div
                                className="flex items-center gap-2 text-sm"
                                role="status"
                            >
                                <Spinner aria-hidden /> Loading repository
                            </div>
                        </StateGroup>
                        <StateGroup title="Overlay">
                            <Dialog>
                                <DialogTrigger
                                    render={<Button variant="outline" />}
                                >
                                    Open dialog
                                </DialogTrigger>
                                <DialogContent closeLabel="Close fixture dialog">
                                    <DialogTitle>Fixture dialog</DialogTitle>
                                    <DialogDescription>
                                        Focus and stacking use the production
                                        primitive
                                    </DialogDescription>
                                </DialogContent>
                            </Dialog>
                        </StateGroup>
                    </div>
                </main>
            </GitClientTheme>
        </AppearanceProvider>
    );
}
