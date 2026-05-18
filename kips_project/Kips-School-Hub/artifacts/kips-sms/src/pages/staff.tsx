import { useState } from "react";
import { useListStaff, useCreateStaff, useUpdateStaff, getListStaffQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, User, Phone, Mail, BookOpen, Pencil, Trash2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2, "Name required"),
  role: z.enum(["teacher", "admin", "accountant", "support"]),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  subject: z.string().optional(),
  salary: z.string().optional(),
  joinDate: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

const roleColors = {
  teacher: "from-blue-500 to-cyan-500",
  admin: "from-purple-500 to-indigo-500",
  accountant: "from-emerald-500 to-green-500",
  support: "from-amber-500 to-orange-500",
};

export default function Staff() {
  const [open, setOpen] = useState(false);
  const [editMember, setEditMember] = useState<null | { id: number; name: string; role: string; phone?: string; email?: string; subject?: string; salary?: string | number | null; joinDate?: string; status: string }>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { token } = useAuthStore();
  const { data: staff, isLoading } = useListStaff();
  const createMutation = useCreateStaff();
  const updateMutation = useUpdateStaff();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { role: "teacher", status: "active" },
  });

  const editForm = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { role: "teacher", status: "active" },
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    createMutation.mutate({
      data: { ...values, salary: values.salary ? Number(values.salary) : undefined }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
        toast({ title: "Staff member added" });
        setOpen(false);
        form.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to add staff" }),
    });
  };

  const openEdit = (member: typeof editMember) => {
    if (!member) return;
    setEditMember(member);
    editForm.reset({
      name: member.name,
      role: member.role as "teacher" | "admin" | "accountant" | "support",
      phone: member.phone ?? "",
      email: member.email ?? "",
      subject: member.subject ?? "",
      salary: member.salary ? String(member.salary) : "",
      joinDate: member.joinDate ?? "",
      status: member.status as "active" | "inactive",
    });
  };

  const onEditSubmit = (values: z.infer<typeof schema>) => {
    if (!editMember) return;
    updateMutation.mutate({
      id: editMember.id,
      data: { ...values, salary: values.salary ? Number(values.salary) : undefined }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
        toast({ title: "Staff member updated" });
        setEditMember(null);
      },
      onError: () => toast({ variant: "destructive", title: "Failed to update staff" }),
    });
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete staff member "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      toast({ title: "Staff member deleted" });
    } catch {
      toast({ variant: "destructive", title: "Failed to delete staff member" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-gray-500 text-sm mt-1">Manage teachers and staff members</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white" data-testid="button-add-staff">
              <Plus className="w-4 h-4 mr-2" /> Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input placeholder="Full name" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Role *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="accountant">Accountant</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="subject" render={({ field }) => (
                  <FormItem><FormLabel>Subject</FormLabel><FormControl><Input placeholder="e.g. Mathematics" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="0300-1234567" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="email@kips.edu.pk" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="salary" render={({ field }) => (
                  <FormItem><FormLabel>Monthly Salary (PKR)</FormLabel><FormControl><Input type="number" placeholder="35000" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="joinDate" render={({ field }) => (
                  <FormItem><FormLabel>Join Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                )} />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Add Staff
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-48" />)}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {!staff?.length ? (
            <div className="col-span-full text-center py-16 text-gray-500">No staff members found</div>
          ) : staff?.map(member => {
            const grad = roleColors[member.role as keyof typeof roleColors] || "from-gray-500 to-slate-500";
            return (
              <Card key={member.id} className="overflow-hidden hover:shadow-md transition-shadow" data-testid={`card-staff-${member.id}`}>
                <div className={`h-2 bg-gradient-to-r ${grad}`} />
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm`}>
                      <span className="text-white font-bold text-lg">{member.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{member.name}</h3>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full capitalize">{member.role}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => openEdit({ id: member.id, name: member.name, role: member.role, phone: member.phone ?? undefined, email: member.email ?? undefined, subject: member.subject ?? undefined, salary: member.salary, joinDate: member.joinDate ?? undefined, status: member.status })}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(member.id, member.name)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    {member.subject && <div className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-gray-400" />{member.subject}</div>}
                    {member.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-400" />{member.phone}</div>}
                    {member.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-400" />{member.email}</div>}
                    {member.salary && <div className="flex items-center gap-2"><span className="text-gray-400 text-xs">Salary:</span><span className="font-medium text-gray-800">PKR {Number(member.salary).toLocaleString()}</span></div>}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{member.status}</span>
                    {member.username && <span className="text-xs font-mono text-gray-400">{member.username}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editMember} onOpenChange={(open) => { if (!open) setEditMember(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Staff Member</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input placeholder="Full name" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="role" render={({ field }) => (
                <FormItem><FormLabel>Role *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="accountant">Accountant</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={editForm.control} name="subject" render={({ field }) => (
                <FormItem><FormLabel>Subject</FormLabel><FormControl><Input placeholder="e.g. Mathematics" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={editForm.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="0300-1234567" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={editForm.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="email@kips.edu.pk" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="salary" render={({ field }) => (
                <FormItem><FormLabel>Monthly Salary (PKR)</FormLabel><FormControl><Input type="number" placeholder="35000" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={editForm.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditMember(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
