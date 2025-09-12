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

interface Participant {
  id: number;
  userId: number;
  tripId: number;
  role: string;
  joinedAt?: string;
  user?: User;
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

interface Repayment {
  id: number;
  tripId: number;
  expenseId: number;
  paidBy: number;
  paidTo: number;
  amount: number;
  currency: string;
  date: string;
  notes?: string;
  paidByUser?: User;
  paidToUser?: User;
  expense?: Expense;
}

interface ParticipantBalance {
  participantId: number;
  participantName: string;
  avatar?: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number; // positive means they are owed money, negative means they owe money
  owesToOthers: { [participantId: number]: number };
  owedByOthers: { [participantId: number]: number };
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
  paidBy: z.number().optional(), // Add paidBy field that's optional in the schema
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

// Repayment form schema
const repaymentSchema = z.object({
  expenseId: z.number().min(1, "Please select an expense"),
  paidBy: z.number().min(1, "Please select who is paying"),
  paidTo: z.number().min(1, "Please select who is receiving"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    { message: "Amount must be a positive number" }
  ),
  currency: z.string().min(1, "Currency is required"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type RepaymentFormValues = z.infer<typeof repaymentSchema>;

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
  const [isAddRepaymentOpen, setIsAddRepaymentOpen] = useState(false);
  
  // Fetch trip participants for payer selection
  const { data: participants = [] as Participant[] } = useQuery({
    queryKey: ["participants", tripId],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}/participants`);
      if (!response.ok) {
        throw new Error("Failed to fetch participants");
      }
      return response.json();
    },
  });

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

  // Fetch repayments for this trip
  const { data: repayments = [], isLoading: isLoadingRepayments } = useQuery({
    queryKey: ["repayments", tripId],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}/repayments`);
      if (!response.ok) {
        throw new Error("Failed to fetch repayments");
      }
      const data = await response.json();
      return data as Repayment[];
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
      paidBy: participants[0]?.id, // Default to first participant if available
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

  // Repayment form
  const repaymentForm = useForm<RepaymentFormValues>({
    resolver: zodResolver(repaymentSchema),
    defaultValues: {
      expenseId: 0,
      paidBy: participants[0]?.id || 0,
      paidTo: participants[1]?.id || 0,
      amount: "",
      currency: "USD",
      date: format(new Date(), "yyyy-MM-dd"),
      notes: "",
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
      // Force refetch the expenses to update the UI
      queryClient.invalidateQueries({ queryKey: ["expenses", tripId] });
      queryClient.invalidateQueries({ queryKey: ["expenses-summary", tripId] });
      
      // Make sure the query is refetched immediately
      queryClient.refetchQueries({ queryKey: ["expenses", tripId] });
      queryClient.refetchQueries({ queryKey: ["expenses-summary", tripId] });
      
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
      // Force refetch the expenses to update the UI
      queryClient.invalidateQueries({ queryKey: ["expenses", tripId] });
      queryClient.invalidateQueries({ queryKey: ["expenses-summary", tripId] });
      
      // Make sure the query is refetched immediately
      queryClient.refetchQueries({ queryKey: ["expenses", tripId] });
      queryClient.refetchQueries({ queryKey: ["expenses-summary", tripId] });
      
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
      // Force refetch the expenses to update the UI
      queryClient.invalidateQueries({ queryKey: ["expenses", tripId] });
      queryClient.invalidateQueries({ queryKey: ["expenses-summary", tripId] });
      
      // Make sure the query is refetched immediately
      queryClient.refetchQueries({ queryKey: ["expenses", tripId] });
      queryClient.refetchQueries({ queryKey: ["expenses-summary", tripId] });
      
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
      // Force refetch the expenses to update the UI
      queryClient.invalidateQueries({ queryKey: ["expenses", tripId] });
      
      // Make sure the query is refetched immediately
      queryClient.refetchQueries({ queryKey: ["expenses", tripId] });
      
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

  // Create repayment mutation
  const createRepaymentMutation = useMutation({
    mutationFn: async (values: RepaymentFormValues) => {
      const response = await fetch(`/api/trips/${tripId}/repayments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create repayment");
      }

      return response.json();
    },
    onSuccess: () => {
      // Force refetch the expenses and repayments to update the UI
      queryClient.invalidateQueries({ queryKey: ["expenses", tripId] });
      queryClient.invalidateQueries({ queryKey: ["expenses-summary", tripId] });
      queryClient.invalidateQueries({ queryKey: ["repayments", tripId] });
      
      // Make sure the query is refetched immediately
      queryClient.refetchQueries({ queryKey: ["expenses", tripId] });
      queryClient.refetchQueries({ queryKey: ["expenses-summary", tripId] });
      queryClient.refetchQueries({ queryKey: ["repayments", tripId] });
      
      toast({
        title: "Repayment added",
        description: "Your repayment has been recorded successfully.",
      });
      setIsAddRepaymentOpen(false);
      repaymentForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate participant balances
  const calculateBalances = (): ParticipantBalance[] => {
    const balanceMap = new Map<number, ParticipantBalance>();

    // Initialize balance map with all participants
    participants.forEach(participant => {
      balanceMap.set(participant.id, {
        participantId: participant.id,
        participantName: participant.name || participant.user?.name || 'Unknown',
        avatar: participant.user?.avatar,
        totalPaid: 0,
        totalOwed: 0,
        netBalance: 0,
        owesToOthers: {},
        owedByOthers: {}
      });
    });

    // Calculate what each participant paid
    expenses.forEach(expense => {
      const balance = balanceMap.get(expense.paidBy);
      if (balance) {
        balance.totalPaid += expense.amount;
      }
    });

    // Calculate what each participant owes (assuming equal split for now)
    expenses.forEach(expense => {
      const splitAmount = expense.amount / participants.length;
      participants.forEach(participant => {
        const balance = balanceMap.get(participant.id);
        if (balance) {
          balance.totalOwed += splitAmount;
          
          // If this participant didn't pay this expense, they owe the payer
          if (participant.id !== expense.paidBy) {
            const payerBalance = balanceMap.get(expense.paidBy);
            if (payerBalance) {
              if (!balance.owesToOthers[expense.paidBy]) {
                balance.owesToOthers[expense.paidBy] = 0;
              }
              balance.owesToOthers[expense.paidBy] += splitAmount;
              
              if (!payerBalance.owedByOthers[participant.id]) {
                payerBalance.owedByOthers[participant.id] = 0;
              }
              payerBalance.owedByOthers[participant.id] += splitAmount;
            }
          }
        }
      });
    });

    // Apply repayments to reduce debts
    repayments.forEach(repayment => {
      const payer = balanceMap.get(repayment.paidBy);
      const receiver = balanceMap.get(repayment.paidTo);
      
      if (payer && receiver) {
        // Reduce the amount owed by the payer to the receiver
        if (payer.owesToOthers[repayment.paidTo]) {
          payer.owesToOthers[repayment.paidTo] = Math.max(0, payer.owesToOthers[repayment.paidTo] - repayment.amount);
        }
        
        // Reduce the amount owed by the payer to the receiver from receiver's perspective
        if (receiver.owedByOthers[repayment.paidBy]) {
          receiver.owedByOthers[repayment.paidBy] = Math.max(0, receiver.owedByOthers[repayment.paidBy] - repayment.amount);
        }
      }
    });

    // Calculate net balances
    balanceMap.forEach((balance) => {
      balance.netBalance = balance.totalPaid - balance.totalOwed;
    });

    return Array.from(balanceMap.values());
  };

  const participantBalances = calculateBalances();

  // Handle creating an expense
  const onSubmit = (data: ExpenseFormValues) => {
    createExpenseMutation.mutate(data);
  };

  // Handle editing an expense
  const onEditSubmit = (data: ExpenseFormValues) => {
    updateExpenseMutation.mutate(data);
  };

  // Handle creating a repayment
  const onRepaymentSubmit = (data: RepaymentFormValues) => {
    createRepaymentMutation.mutate(data);
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
      paidBy: expense.paidBy, // Add the paidBy field
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

  if (isLoadingExpenses || isLoadingSummary || isLoadingRepayments) {
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
              paidBy: participants[0]?.id, // Default to first participant if available
            });
            setIsAddExpenseOpen(true);
          }}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
        <Button 
          onClick={() => {
            setIsAddRepaymentOpen(true);
          }}
          variant="outline"
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Add Repayment
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">Expenses List</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
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

        {/* Balances Tab */}
        <TabsContent value="balances" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Participant Balances</CardTitle>
              <CardDescription>
                Track who owes whom and settle up expenses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {participantBalances.length === 0 ? (
                <div className="text-center py-10">
                  <CircleDollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-lg font-semibold">No balance data</h3>
                  <p className="text-sm text-muted-foreground">
                    Add some expenses to see participant balances.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Overall Balance Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {participantBalances.map((balance) => (
                      <Card key={balance.participantId} className="relative">
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={balance.avatar} alt={balance.participantName} />
                              <AvatarFallback>
                                {balance.participantName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-base font-medium">
                                {balance.participantName}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                Net Balance
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Net Balance:</span>
                              <span className={`font-semibold ${
                                balance.netBalance > 0 
                                  ? 'text-green-600' 
                                  : balance.netBalance < 0 
                                  ? 'text-red-600' 
                                  : 'text-gray-600'
                              }`}>
                                {formatCurrency(Math.abs(balance.netBalance), 'USD')}
                                {balance.netBalance > 0 && ' (owed to you)'}
                                {balance.netBalance < 0 && ' (you owe)'}
                                {balance.netBalance === 0 && ' (settled)'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Total Paid:</span>
                              <span className="text-sm">
                                {formatCurrency(balance.totalPaid, 'USD')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Share of Expenses:</span>
                              <span className="text-sm">
                                {formatCurrency(balance.totalOwed, 'USD')}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Detailed Debt Breakdown */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Settlement Details</h3>
                    {participantBalances.map((balance) => {
                      const hasDebts = Object.keys(balance.owesToOthers).some(id => balance.owesToOthers[parseInt(id)] > 0);
                      const hasCredits = Object.keys(balance.owedByOthers).some(id => balance.owedByOthers[parseInt(id)] > 0);
                      
                      if (!hasDebts && !hasCredits) return null;
                      
                      return (
                        <Card key={`details-${balance.participantId}`}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={balance.avatar} alt={balance.participantName} />
                                <AvatarFallback className="text-xs">
                                  {balance.participantName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {balance.participantName}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {/* What this person owes to others */}
                            {hasDebts && (
                              <div>
                                <h4 className="text-sm font-medium text-red-600 mb-2">Owes:</h4>
                                <div className="space-y-1">
                                  {Object.entries(balance.owesToOthers).map(([creditorId, amount]) => {
                                    if (amount <= 0) return null;
                                    const creditor = participants.find(p => p.id === parseInt(creditorId));
                                    return (
                                      <div key={`debt-${creditorId}`} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                          <Avatar className="h-5 w-5">
                                            <AvatarImage src={creditor?.user?.avatar} alt={creditor?.name} />
                                            <AvatarFallback className="text-xs">
                                              {creditor?.name?.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span>{creditor?.name || 'Unknown'}</span>
                                        </div>
                                        <span className="text-red-600 font-medium">
                                          {formatCurrency(amount, 'USD')}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {/* What others owe to this person */}
                            {hasCredits && (
                              <div>
                                <h4 className="text-sm font-medium text-green-600 mb-2">Owed by:</h4>
                                <div className="space-y-1">
                                  {Object.entries(balance.owedByOthers).map(([debtorId, amount]) => {
                                    if (amount <= 0) return null;
                                    const debtor = participants.find(p => p.id === parseInt(debtorId));
                                    return (
                                      <div key={`credit-${debtorId}`} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                          <Avatar className="h-5 w-5">
                                            <AvatarImage src={debtor?.user?.avatar} alt={debtor?.name} />
                                            <AvatarFallback className="text-xs">
                                              {debtor?.name?.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span>{debtor?.name || 'Unknown'}</span>
                                        </div>
                                        <span className="text-green-600 font-medium">
                                          {formatCurrency(amount, 'USD')}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
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
              
              <FormField
                control={form.control}
                name="paidBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid By</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select who paid" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {participants.map((participant) => (
                          <SelectItem key={participant.id} value={participant.id.toString()}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span>{participant.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
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
              
              <FormField
                control={editForm.control}
                name="paidBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid By</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select who paid" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {participants.map((participant) => (
                          <SelectItem key={participant.id} value={participant.id.toString()}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span>{participant.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
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

      {/* Add Repayment Dialog */}
      <Dialog open={isAddRepaymentOpen} onOpenChange={setIsAddRepaymentOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Repayment</DialogTitle>
            <DialogDescription>
              Record a repayment between participants for a specific expense
            </DialogDescription>
          </DialogHeader>
          
          <Form {...repaymentForm}>
            <form onSubmit={repaymentForm.handleSubmit(onRepaymentSubmit)} className="space-y-4">
              <FormField
                control={repaymentForm.control}
                name="expenseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Expense</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select the expense being repaid" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {expenses.map((expense) => (
                          <SelectItem key={expense.id} value={expense.id.toString()}>
                            <div className="flex items-center justify-between w-full">
                              <span>{expense.title}</span>
                              <span className="text-muted-foreground ml-2">
                                {formatCurrency(expense.amount, expense.currency)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={repaymentForm.control}
                  name="paidBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paid By</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))} 
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Who is paying" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {participants.map((participant) => (
                            <SelectItem key={participant.id} value={participant.id.toString()}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback>{participant.name?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                                <span>{participant.name || participant.user?.name || 'Unknown'}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={repaymentForm.control}
                  name="paidTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paid To</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))} 
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Who is receiving" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {participants.map((participant) => (
                            <SelectItem key={participant.id} value={participant.id.toString()}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback>{participant.name?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                                <span>{participant.name || participant.user?.name || 'Unknown'}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={repaymentForm.control}
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
                  control={repaymentForm.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
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
              
              <FormField
                control={repaymentForm.control}
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
              
              <FormField
                control={repaymentForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Add any notes about this repayment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddRepaymentOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createRepaymentMutation.isPending}
                >
                  {createRepaymentMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Repayment
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