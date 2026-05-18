import { useState } from "react";
import { useLocation } from "wouter";
import { useListClasses, useCreateClass } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookOpen, Users, Loader2, ChevronRight } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  grade: z.string().min(1, "Grade is required"),
  sections: z.string().optional(),
});

type ClassFormValues = z.infer<typeof schema>;

export default function Classes() {
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: classes, isLoading } = useListClasses();
  const createMutation = useCreateClass();

  const createForm = useForm<ClassFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", grade: "", sections: "" },
  });

  const onCreateSubmit = (values: ClassFormValues) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["listClasses"] });
        toast({ title: "Class created successfully" });
        setCreateOpen(false);
        createForm.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create class" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="text-gray-500 text-sm mt-1">Class card par click karein students dekhne ke liye</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white" data-testid="button-add-class">
              <Plus className="w-4 h-4 mr-2" /> Add Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Class</DialogTitle></DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField control={createForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. Class 6" {...field} data-testid="input-class-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={createForm.control} name="grade" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade *</FormLabel>
                    <FormControl><Input placeholder="e.g. Grade 6" {...field} data-testid="input-grade" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={createForm.control} name="sections" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sections (comma-separated)</FormLabel>
                    <FormControl><Input placeholder="A,B,C" {...field} data-testid="input-sections" /></FormControl>
                  </FormItem>
                )} />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-class">
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Create
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {classes?.map(cls => (
            <Card
              key={cls.id}
              className="hover:shadow-lg transition-all cursor-pointer group border hover:border-indigo-300 hover:-translate-y-0.5"
              onClick={() => setLocation(`/students?classId=${cls.id}`)}
              data-testid={`card-class-${cls.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-gray-500 text-sm bg-indigo-50 px-2 py-1 rounded-full">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="font-bold text-indigo-600">{cls.studentCount ?? 0}</span>
                  </div>
                </div>

                <h3 className="mt-3 font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">
                  {cls.name}
                </h3>
                <p className="text-sm text-gray-500">{cls.grade}</p>

                {cls.sections && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {cls.sections.split(",").map(s => (
                      <span key={s} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs font-medium border border-indigo-100">
                        Section {s.trim()}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center text-xs text-indigo-400 group-hover:text-indigo-600 transition-colors font-medium">
                  <span>Students dekhein</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
