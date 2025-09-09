import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, DollarSign, Plus, TrendingUp, Users, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const TripSpending = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Mock expense data
  const [expenses] = useState([
    {
      id: "1",
      title: "Hotel Booking - Ubud Resort",
      amount: 450,
      currency: "USD",
      category: "accommodation",
      date: "2024-08-15",
      paidBy: "Alex Chen",
      splitAmong: ["Alex Chen", "Sarah Miller"]
    },
    {
      id: "2",
      title: "Flight Tickets",
      amount: 800,
      currency: "USD", 
      category: "transportation",
      date: "2024-08-10",
      paidBy: "Sarah Miller",
      splitAmong: ["Alex Chen", "Sarah Miller"]
    },
    {
      id: "3",
      title: "Temple Tour Guide",
      amount: 120,
      currency: "USD",
      category: "activities",
      date: "2024-08-16",
      paidBy: "Alex Chen",
      splitAmong: ["Alex Chen", "Sarah Miller"]
    },
    {
      id: "4",
      title: "Dinner at Local Restaurant",
      amount: 85,
      currency: "USD",
      category: "food",
      date: "2024-08-16",
      paidBy: "Sarah Miller",
      splitAmong: ["Alex Chen", "Sarah Miller"]
    }
  ]);

  const budget = {
    total: 2500,
    currency: "USD",
    categories: {
      accommodation: 800,
      transportation: 600,
      food: 500,
      activities: 400,
      other: 200
    }
  };

  const getCategorySpent = (category: string) => {
    return expenses
      .filter(expense => expense.category === category)
      .reduce((sum, expense) => sum + expense.amount, 0);
  };

  const getTotalSpent = () => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "accommodation": return "bg-blue-100 text-blue-800 border-blue-200";
      case "transportation": return "bg-green-100 text-green-800 border-green-200";
      case "food": return "bg-orange-100 text-orange-800 border-orange-200";
      case "activities": return "bg-purple-100 text-purple-800 border-purple-200";
      case "other": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const totalSpent = getTotalSpent();
  const remainingBudget = budget.total - totalSpent;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/trips/${id}`)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Trip
              </Button>
              <h1 className="text-xl font-semibold">Trip Expenses</h1>
            </div>
            
            <Button variant="adventure">
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </div>
        </div>
      </header>

      {/* Expenses Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Budget Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Budget</p>
                      <p className="text-xl font-bold">${budget.total.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-destructive/10">
                      <TrendingUp className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Spent</p>
                      <p className="text-xl font-bold">${totalSpent.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/20">
                      <Receipt className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Remaining</p>
                      <p className="text-xl font-bold text-accent-foreground">
                        ${remainingBudget.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Budget by Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(budget.categories).map(([category, budgetAmount]) => {
                  const spent = getCategorySpent(category);
                  const percentage = (spent / budgetAmount) * 100;
                  
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="capitalize font-medium">{category}</span>
                        <span className="text-sm text-muted-foreground">
                          ${spent} / ${budgetAmount}
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Recent Expenses */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Expenses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {expenses.map((expense) => (
                  <div 
                    key={expense.id}
                    className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:shadow-soft transition-all"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-foreground">{expense.title}</h4>
                        <span className="text-lg font-semibold">
                          ${expense.amount}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{formatDate(expense.date)}</span>
                        <span>Paid by {expense.paidBy}</span>
                        <Badge 
                          variant="outline" 
                          className={`${getCategoryColor(expense.category)} border`}
                        >
                          {expense.category}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />
                        <span>Split among {expense.splitAmong.length} people</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Spending Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Spending Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10">
                  <div className="text-2xl font-bold text-foreground">
                    {((totalSpent / budget.total) * 100).toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground">of budget used</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Average per person</span>
                    <span className="font-medium">${(totalSpent / 2).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total expenses</span>
                    <span className="font-medium">{expenses.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Daily average</span>
                    <span className="font-medium">${(totalSpent / 7).toFixed(0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Expense
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Receipt className="w-4 h-4 mr-2" />
                  Upload Receipt
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  View Report
                </Button>
              </CardContent>
            </Card>

            {/* Top Categories */}
            <Card>
              <CardHeader>
                <CardTitle>Top Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(budget.categories)
                  .sort(([categoryA], [categoryB]) => getCategorySpent(categoryB) - getCategorySpent(categoryA))
                  .slice(0, 3)
                  .map(([category]) => (
                    <div key={category} className="flex justify-between items-center">
                      <span className="capitalize text-sm">{category}</span>
                      <span className="font-medium">${getCategorySpent(category)}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TripSpending;