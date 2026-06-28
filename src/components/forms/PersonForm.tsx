import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLedge } from "@/features/dataProvider";
import type { Person, PersonTag } from "@/lib/types";
import { toast } from "sonner";

const TAGS: PersonTag[] = ["family", "friends", "work", "other"];

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal("")),
  notes: z.string().max(500).optional(),
});

export type PersonFormValues = z.infer<typeof schema>;

export function PersonForm({
  person,
  onSubmitted,
}: {
  person?: Person;
  onSubmitted?: (id: string) => void;
}) {
  const { createPerson, updatePerson } = useLedge();
  const form = useForm<PersonFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: person?.name ?? "",
      phone: person?.phone ?? "",
      notes: person?.notes ?? "",
    },
  });
  const tags = (person?.tags ?? []) as PersonTag[];
  const selected = new Set<PersonTag>(tags);
  // Mutable holder so toggle re-renders via form state
  const tagsField = form.watch("name"); // keep form connected
  void tagsField;

  async function onSubmit(values: PersonFormValues) {
    try {
      const tagValues = Array.from(selected);
      if (person) {
        await updatePerson(person.id, {
          name: values.name,
          phone: values.phone || undefined,
          notes: values.notes || undefined,
          tags: tagValues,
        });
        toast.success("Updated");
        onSubmitted?.(person.id);
      } else {
        const p = await createPerson({
          name: values.name,
          phone: values.phone || undefined,
          notes: values.notes || undefined,
          tags: tagValues,
        });
        toast.success(`Added ${p.name}`);
        onSubmitted?.(p.id);
      }
    } catch (e) {
      toast.error((e as Error).message ?? "Could not save");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input autoFocus placeholder="e.g. Rahul" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Phone <span className="text-xs text-muted-foreground">(optional)</span></Label>
        <Input inputMode="tel" placeholder="+91…" {...form.register("phone")} />
      </div>
      <div className="space-y-1.5">
        <Label>Tags</Label>
        <ToggleGroup
          type="multiple"
          defaultValue={tags}
          onValueChange={(v) => {
            selected.clear();
            v.forEach((x) => selected.add(x as PersonTag));
          }}
          className="flex-wrap justify-start"
        >
          {TAGS.map((t) => (
            <ToggleGroupItem key={t} value={t} className="capitalize">
              {t}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea rows={2} {...form.register("notes")} />
      </div>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {person ? "Save changes" : "Add person"}
      </Button>
    </form>
  );
}
