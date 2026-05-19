import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateStudent, useListClasses } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Upload, User, Camera } from "lucide-react";

const schema = z.object({
  name:             z.string().min(2, "Name required"),
  fatherName:       z.string().optional(),
  motherName:       z.string().optional(),
  dateOfBirth:      z.string().optional(),
  gender:           z.enum(["male", "female"]).optional(),
  address:          z.string().optional(),
  phone:            z.string().optional(),
  emergencyContact: z.string().optional(),
  classId:          z.string().min(1, "Class required"),
  section:          z.string().optional(),
  rollNumber:       z.string().optional(),
  feeAmount:        z.string().optional(),
  siblingDiscount:  z.string().optional(),
  status:           z.enum(["active", "inactive", "left"]).default("active"),
});

function authHeader() {
  const token = localStorage.getItem("kips_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function StudentNew() {
  const [, setLocation] = useLocation();
  const { toast }       = useToast();
  const queryClient     = useQueryClient();
  const fileInputRef    = useRef<HTMLInputElement>(null);

  const [imagePreview,   setImagePreview]   = useState<string | null>(null);
  const [imageFile,      setImageFile]      = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: classes } = useListClasses();
  const createMutation    = useCreateStudent();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { status: "active" },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (values: z.infer<typeof schema>) => {
    createMutation.mutate(
      {
        data: {
          ...values,
          classId:         Number(values.classId),
          feeAmount:       values.feeAmount       ? Number(values.feeAmount)       : undefined,
          siblingDiscount: values.siblingDiscount ? Number(values.siblingDiscount) : 0,
        },
      },
      {
        onSuccess: async (student) => {
          // Upload image if selected
          if (imageFile && student.id) {
            setUploadingImage(true);
            try {
              const formData = new FormData();
              formData.append("image", imageFile);
              await fetch(`/api/students/${student.id}/image`, {
                method: "POST",
                headers: authHeader() as HeadersInit,
                body: formData,
              });
            } catch {
              toast({ variant: "destructive", title: "Student created but photo upload failed" });
            } finally {
              setUploadingImage(false);
            }
          }

          queryClient.invalidateQueries({ queryKey: ["listStudents"] });
          toast({ title: "Student admitted successfully!" });
          setLocation("/students");
        },
        onError: () => toast({ variant: "destructive", title: "Failed to admit student" }),
      }
    );
  };

  const isPending = createMutation.isPending || uploadingImage;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/students")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Student Admission</h1>
          <p className="text-gray-500 text-sm mt-0.5">Fill in the details to admit a new student</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* ── Photo Upload ─────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Student Photo</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                {/* Preview */}
                <div
                  className="w-28 h-28 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-indigo-400 transition-colors bg-gray-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-gray-400">
                      <User className="w-10 h-10 mx-auto mb-1" />
                      <p className="text-xs">No photo</p>
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    {imagePreview ? "Change Photo" : "Upload Photo"}
                  </Button>
                  {imagePreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-500 text-sm"
                      onClick={() => { setImagePreview(null); setImageFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    >
                      Remove
                    </Button>
                  )}
                  <p className="text-xs text-gray-400">JPG, PNG, WebP — max 5MB</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleImageChange}
              />
            </CardContent>
          </Card>

          {/* ── Personal Info ─────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl><Input placeholder="Student full name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="fatherName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Father's Name</FormLabel>
                  <FormControl><Input placeholder="Father name" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="motherName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mother's Name</FormLabel>
                  <FormControl><Input placeholder="Mother name" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input placeholder="0300-1234567" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="emergencyContact" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact</FormLabel>
                  <FormControl><Input placeholder="Emergency number" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Address</FormLabel>
                  <FormControl><Input placeholder="Full address" {...field} /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── Academic Info ─────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Academic Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="classId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Class *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {classes?.map(cls => (
                        <SelectItem key={cls.id} value={String(cls.id)}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="section" render={({ field }) => (
                <FormItem>
                  <FormLabel>Section</FormLabel>
                  <FormControl><Input placeholder="A" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="rollNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Roll Number</FormLabel>
                  <FormControl><Input placeholder="01" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="feeAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Fee (PKR)</FormLabel>
                  <FormControl><Input type="number" placeholder="2500" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="siblingDiscount" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    Sibling Discount (PKR)
                    <span className="text-xs text-blue-600 font-normal">(if applicable)</span>
                  </FormLabel>
                  <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                  <p className="text-xs text-gray-500">Monthly discount for students with siblings in school</p>
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="left">Left</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setLocation("/students")}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8"
            >
              {isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />
                {uploadingImage ? "Uploading Photo..." : "Saving..."}</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Admit Student</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}