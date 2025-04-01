import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger, 
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
} from "@/components/ui/form";
import { format } from "date-fns";
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { 
  BadgeDollarSign, 
  BadgeEuro,
  BadgePoundSterling,
  BadgeJapaneseYen,
  Calendar, 
  PlusCircle, 
  Trash2, 
  Edit, 
  DollarSign,
  ReceiptText,
  ShoppingBag,
  Plane,
  Train,
  Bus,
  Coffee,
  Utensils,
  Hotel,
  Ticket,
  Landmark,
  Briefcase,
  HeartPulse,
  GraduationCap,
  ShoppingCart,
  CircleDollarSign,
  CreditCard,
  MoreHorizontal,
  Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Type definitions based on database schema
interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}

interface Expense {
  id: number;
  tripId: number;
  paidBy: number;
  title: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  createdAt?: string;
  updatedAt?: string;
  user?: User;
  splits?: ExpenseSplit[];
}

interface ExpenseSplit {
  id: number;
  expenseId: number;
  userId: number;
  amount: number;
  status: 'pending' | 'paid';
  user?: User;
}

interface ExpenseSummary {
  totalExpenses: number;
  currency: string;
  categoryBreakdown: {
    category: string;
    amount: number;
    percentage: string;
  }[];
  dateBreakdown: {
    date: string;
    amount: number;
  }[];
}

// Form schemas
const expenseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    { message: "Amount must be a positive number" }
  ),
  currency: z.string().min(1, "Currency is required"),
  category: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  // Optional: Custom split amounts
  splits: z.array(
    z.object({
      userId: z.number(),
      amount: z.string(),
      status: z.enum(["pending", "paid"]),
    })
  ).optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

// Category icons mapping
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "food": <Utensils size={16} />,
  "accommodation": <Hotel size={16} />,
  "transportation": <Plane size={16} />,
  "activities": <Ticket size={16} />,
  "shopping": <ShoppingBag size={16} />,
  "health": <HeartPulse size={16} />,
  "education": <GraduationCap size={16} />,
  "entertainment": <Landmark size={16} />,
  "business": <Briefcase size={16} />,
  "other": <ReceiptText size={16} />,
};

// Currency icons mapping
const CURRENCY_ICONS: Record<string, React.ReactNode> = {
  "USD": <BadgeDollarSign size={16} />,
  "EUR": <BadgeEuro size={16} />,
  "GBP": <BadgePoundSterling size={16} />,
  "JPY": <BadgeJapaneseYen size={16} />,
  "default": <CircleDollarSign size={16} />,
};

// Pie chart colors
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#FF6B6B', '#4CAF50', '#9C27B0', '#FF9800', '#607D8B'];

interface BudgetTrackerProps {
  tripId: number;
}

export function BudgetTracker({ tripId }: BudgetTrackerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isEditExpenseOpen, setIsEditExpenseOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [activeTab, setActiveTab] = useState("list");

  // Fetch all expenses for this trip
  const { data: expenses = [], isLoading: isLoadingExpenses } = useQuery({
    queryKey: ["expenses", tripId],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}/expenses`);
      if (!response.ok) {
        throw new Error("Failed to fetch expenses");
      }
      const data = await response.json();
      return data as Expense[];
    },
  });

  // Fetch expense summary
  const { data: summary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ["expenses-summary", tripId],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}/expenses/summary`);
      if (!response.ok) {
        throw new Error("Failed to fetch expense summary");
      }
      const data = await response.json();
      return data as ExpenseSummary;
    },
  });

  // Create expense form
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: "",
      amount: "",
      currency: "USD",
      category: "other",
      date: format(new Date(), "yyyy-MM-dd"),
    },
  });

  // Edit expense form
  const editForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: "",
      amount: "",
      currency: "USD",
      category: "other",
      date: format(new Date(), "yyyy-MM-dd"),
    },
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      const response = await fetch(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create expense");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["expenses", tripId]);
      queryClient.invalidateQueries(["expenses-summary", tripId]);
      toast({
        title: "Expense added",
        description: "Your expense has been added successfully.",
      });
      setIsAddExpenseOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update expense mutation
  const updateExpenseMutation = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      if (!selectedExpense) return null;

      const response = await fetch(`/api/trips/${tripId}/expenses/${selectedExpense.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update expense");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["expenses", tripId]);
      queryClient.invalidateQueries(["expenses-summary", tripId]);
      toast({
        title: "Expense updated",
        description: "Your expense has been updated successfully.",
      });
      setIsEditExpenseOpen(false);
      setSelectedExpense(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!expenseToDelete) return null;

      const response = await fetch(`/api/trips/${tripId}/expenses/${expenseToDelete.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete expense");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["expenses", tripId]);
      queryClient.invalidateQueries(["expenses-summary", tripId]);
      toast({
        title: "Expense deleted",
        description: "The expense has been deleted successfully.",
      });
      setExpenseToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mark expense split as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async ({ splitId, status }: { splitId: number; status: 'pending' | 'paid' }) => {
      const response = await fetch(`/api/trips/${tripId}/expenses/${selectedExpense?.id}/splits/${splitId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update split status");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["expenses", tripId]);
      toast({
        title: "Status updated",
        description: "The payment status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle creating an expense
  const onSubmit = (data: ExpenseFormValues) => {
    createExpenseMutation.mutate(data);
  };

  // Handle editing an expense
  const onEditSubmit = (data: ExpenseFormValues) => {
    updateExpenseMutation.mutate(data);
  };

  // Handle edit button click
  const handleEditClick = (expense: Expense) => {
    setSelectedExpense(expense);
    editForm.reset({
      title: expense.title,
      amount: expense.amount.toString(),
      currency: expense.currency,
      category: expense.category,
      date: format(new Date(expense.date), "yyyy-MM-dd"),
    });
    setIsEditExpenseOpen(true);
  };

  // Handle delete button click
  const handleDeleteClick = (expense: Expense) => {
    setExpenseToDelete(expense);
  };

  // Toggle an expense split's paid status
  const toggleSplitStatus = (splitId: number, currentStatus: 'pending' | 'paid') => {
    const newStatus = currentStatus === 'pending' ? 'paid' : 'pending';
    markAsPaidMutation.mutate({ splitId, status: newStatus });
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(amount);
  };

  // Get category icon
  const getCategoryIcon = (category: string) => {
    return CATEGORY_ICONS[category] || CATEGORY_ICONS["other"];
  };

  // Get currency icon
  const getCurrencyIcon = (currency: string) => {
    return CURRENCY_ICONS[currency] || CURRENCY_ICONS["default"];
  };

  if (isLoadingExpenses || isLoadingSummary) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading expense data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Budget Tracker</h2>
          <p className="text-muted-foreground">
            Manage and track expenses for your trip
          </p>
        </div>
        
        <Button 
          onClick={() => {
            form.reset({
              title: "",
              amount: "",
              currency: "USD",
              category: "other",
              date: format(new Date(), "yyyy-MM-dd"),
            });
            setIsAddExpenseOpen(true);
          }}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">Expenses List</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
        </TabsList>

        {/* Expenses List Tab */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>All Expenses</CardTitle>
              <CardDescription>
                {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'} recorded
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {expenses.length === 0 ? (
                  <div className="text-center py-10">
                    <ReceiptText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-lg font-semibold">No expenses yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Add your first expense using the button above.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Paid By</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(expense.date), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell className="font-medium">{expense.title}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {getCategoryIcon(expense.category)}
                              <span className="capitalize">
                                {expense.category}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={expense.user?.avatar} alt={expense.user?.name} />
                                <AvatarFallback>{expense.user?.name?.charAt(0) || 'U'}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{expense.user?.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {getCurrencyIcon(expense.currency)}
                              {formatCurrency(expense.amount, expense.currency)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleEditClick(expense)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDeleteClick(expense)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="flex w-full justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {summary?.totalExpenses ? (
                    <>Showing {expenses.length} expense{expenses.length !== 1 && 's'}</>
                  ) : (
                    <>No expenses recorded</>
                  )}
                </div>
                {summary?.totalExpenses > 0 && (
                  <div className="font-bold flex items-center gap-1">
                    Total: {formatCurrency(summary.totalExpenses, summary.currency)}
                  </div>
                )}
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expense Summary</CardTitle>
              <CardDescription>
                Overview of your trip expenses by category
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summary?.totalExpenses > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium">
                          Total Expenses
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-1">
                          <CircleDollarSign className="h-5 w-5 text-primary" />
                          <span className="text-2xl font-bold">
                            {formatCurrency(summary.totalExpenses, summary.currency)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium">
                          Largest Category
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {summary.categoryBreakdown.length > 0 ? (
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(summary.categoryBreakdown[0].category)}
                            <div>
                              <div className="font-medium capitalize">
                                {summary.categoryBreakdown[0].category}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatCurrency(summary.categoryBreakdown[0].amount, summary.currency)} 
                                <span className="ml-1 text-xs">
                                  ({summary.categoryBreakdown[0].percentage}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">No data available</div>
                        )}
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium">
                          Most Recent Expense
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {expenses.length > 0 ? (
                          <div className="text-sm">
                            <div className="font-medium">{expenses[0].title}</div>
                            <div className="flex justify-between items-center mt-1">
                              <div className="text-muted-foreground">
                                {format(new Date(expenses[0].date), "MMM dd, yyyy")}
                              </div>
                              <Badge variant="outline">
                                {formatCurrency(expenses[0].amount, expenses[0].currency)}
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">No expenses yet</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Expense Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {summary.categoryBreakdown.map((category, index) => (
                          <div key={category.category} className="grid grid-cols-6 gap-2 items-center">
                            <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
                              {getCategoryIcon(category.category)}
                              <span className="font-medium capitalize">
                                {category.category}
                              </span>
                            </div>
                            <div className="col-span-4 sm:col-span-5">
                              <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium">
                                  {formatCurrency(category.amount, summary.currency)}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {category.percentage}%
                                </span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2.5">
                                <div 
                                  className="h-2.5 rounded-full" 
                                  style={{ 
                                    width: `${category.percentage}%`,
                                    backgroundColor: COLORS[index % COLORS.length]
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8">
                  <ReceiptText className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-xl font-semibold">No expense data yet</h3>
                  <p className="text-muted-foreground mt-1">
                    Add expenses to see your spending breakdown
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      form.reset();
                      setIsAddExpenseOpen(true);
                    }}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add First Expense
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expense Visualization</CardTitle>
              <CardDescription>
                Visualize your expenses by category and over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summary?.totalExpenses > 0 ? (
                <div className="space-y-8">
                  <div className="rounded-lg border bg-card text-card-foreground shadow">
                    <div className="p-6">
                      <h3 className="font-semibold">Expenses by Category</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={summary.categoryBreakdown}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="amount"
                            nameKey="category"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {summary.categoryBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value) => [formatCurrency(value as number, summary.currency), "Amount"]} 
                            labelFormatter={(label) => `${label}`}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  
                  {summary.dateBreakdown.length > 1 && (
                    <div className="rounded-lg border bg-card text-card-foreground shadow">
                      <div className="p-6">
                        <h3 className="font-semibold">Expenses Over Time</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart
                            data={summary.dateBreakdown}
                            margin={{
                              top: 20,
                              right: 30,
                              left: 20,
                              bottom: 5,
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date" 
                              tick={{ fontSize: 12 }}
                              tickFormatter={(date) => format(new Date(date), "MMM dd")}
                            />
                            <YAxis 
                              tick={{ fontSize: 12 }}
                              tickFormatter={(value) => {
                                if (value >= 1000) {
                                  return `${summary.currency} ${(value / 1000).toFixed(1)}k`;
                                }
                                return `${summary.currency} ${value}`;
                              }}
                            />
                            <Tooltip 
                              formatter={(value) => [formatCurrency(value as number, summary.currency), "Amount"]}
                              labelFormatter={(label) => format(new Date(label as string), "MMMM dd, yyyy")}
                            />
                            <Bar 
                              dataKey="amount" 
                              fill="#0088FE" 
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ReceiptText className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-xl font-semibold">No chart data available</h3>
                  <p className="text-muted-foreground mt-1">
                    Add expenses to see visualization of your spending
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      form.reset();
                      setIsAddExpenseOpen(true);
                    }}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add First Expense
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Expense Dialog */}
      <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>
              Enter the details of your expense
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Dinner, Hotel, Tickets, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type="number" 
                            placeholder="0.00" 
                            step="0.01" 
                            min="0.01" 
                            className="pl-8" 
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">
                            <div className="flex items-center">
                              <BadgeDollarSign className="mr-2 h-4 w-4" />
                              <span>USD ($)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="EUR">
                            <div className="flex items-center">
                              <BadgeEuro className="mr-2 h-4 w-4" />
                              <span>EUR (€)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="GBP">
                            <div className="flex items-center">
                              <BadgePoundSterling className="mr-2 h-4 w-4" />
                              <span>GBP (£)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="JPY">
                            <div className="flex items-center">
                              <BadgeJapaneseYen className="mr-2 h-4 w-4" />
                              <span>JPY (¥)</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="food">
                            <div className="flex items-center">
                              <Utensils className="mr-2 h-4 w-4" />
                              <span>Food & Drinks</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="accommodation">
                            <div className="flex items-center">
                              <Hotel className="mr-2 h-4 w-4" />
                              <span>Accommodation</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="transportation">
                            <div className="flex items-center">
                              <Plane className="mr-2 h-4 w-4" />
                              <span>Transportation</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="activities">
                            <div className="flex items-center">
                              <Ticket className="mr-2 h-4 w-4" />
                              <span>Activities</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="shopping">
                            <div className="flex items-center">
                              <ShoppingBag className="mr-2 h-4 w-4" />
                              <span>Shopping</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="other">
                            <div className="flex items-center">
                              <ReceiptText className="mr-2 h-4 w-4" />
                              <span>Other</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input type="date" className="pl-8" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddExpenseOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createExpenseMutation.isPending}
                >
                  {createExpenseMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Expense
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={isEditExpenseOpen} onOpenChange={setIsEditExpenseOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update the details of this expense
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Dinner, Hotel, Tickets, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type="number" 
                            placeholder="0.00" 
                            step="0.01" 
                            min="0.01" 
                            className="pl-8" 
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">
                            <div className="flex items-center">
                              <BadgeDollarSign className="mr-2 h-4 w-4" />
                              <span>USD ($)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="EUR">
                            <div className="flex items-center">
                              <BadgeEuro className="mr-2 h-4 w-4" />
                              <span>EUR (€)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="GBP">
                            <div className="flex items-center">
                              <BadgePoundSterling className="mr-2 h-4 w-4" />
                              <span>GBP (£)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="JPY">
                            <div className="flex items-center">
                              <BadgeJapaneseYen className="mr-2 h-4 w-4" />
                              <span>JPY (¥)</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="food">
                            <div className="flex items-center">
                              <Utensils className="mr-2 h-4 w-4" />
                              <span>Food & Drinks</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="accommodation">
                            <div className="flex items-center">
                              <Hotel className="mr-2 h-4 w-4" />
                              <span>Accommodation</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="transportation">
                            <div className="flex items-center">
                              <Plane className="mr-2 h-4 w-4" />
                              <span>Transportation</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="activities">
                            <div className="flex items-center">
                              <Ticket className="mr-2 h-4 w-4" />
                              <span>Activities</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="shopping">
                            <div className="flex items-center">
                              <ShoppingBag className="mr-2 h-4 w-4" />
                              <span>Shopping</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="other">
                            <div className="flex items-center">
                              <ReceiptText className="mr-2 h-4 w-4" />
                              <span>Other</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input type="date" className="pl-8" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditExpenseOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={updateExpenseMutation.isPending}
                >
                  {updateExpenseMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this expense and all its payment records. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteExpenseMutation.mutate()}
              disabled={deleteExpenseMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteExpenseMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}