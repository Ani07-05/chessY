import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Settings, User, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UserNavProps {
  user: {
    id: string;
    username: string;
    email?: string;
    avatarUrl?: string;
    chessUsername?: string;
  };
  isSuperAdmin: boolean;
  onLogout: () => Promise<void>;
}

export function UserNav({ user, isSuperAdmin, onLogout }: UserNavProps) {
  const supabase = createClientComponentClient();
  const [isOpen, setIsOpen] = useState(false);
  const [chessUsername, setChessUsername] = useState(user.chessUsername || "");
  const [isLoading, setIsLoading] = useState(false);

  const validateChessUsername = async (username: string): Promise<boolean> => {
    try {
      const response = await fetch(`https://api.chess.com/pub/player/${username}`);
      if (!response.ok) {
        const data = await response.json();
        console.error('Chess.com API error:', data);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error validating chess.com username:', error);
      return false;
    }
  };

  const updateChessUsername = async () => {
    if (!chessUsername.trim()) {
      toast.error("Please enter a Chess.com username");
      return;
    }

    setIsLoading(true);
    try {
      // First validate if the chess.com username exists
      const isValid = await validateChessUsername(chessUsername);
      if (!isValid) {
        toast.error("Invalid Chess.com username. Please check and try again.");
        return;
      }

      // Update the username in the database using user ID
      const { error } = await supabase
        .from('users')
        .update({ 
          chess_username: chessUsername.toLowerCase().trim()
        })
        .eq('id', user.id);

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message);
      }

      toast.success("Chess.com username updated successfully!");
      setIsOpen(false);
      // Reload page to refresh stats
      window.location.reload();
    } catch (error) {
      console.error('Error updating chess username:', error);
      toast.error(error instanceof Error ? error.message : "Failed to update Chess.com username. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatarUrl} alt={user.username} />
              <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.username}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
              {user.chessUsername && (
                <p className="text-xs text-primary">
                  Chess.com: {user.chessUsername}
                </p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DialogTrigger asChild>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Chess.com Settings</span>
            </DropdownMenuItem>
          </DialogTrigger>
          {isSuperAdmin && (
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <User className="mr-2 h-4 w-4" />
              <span>Admin Panel</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600"
            onSelect={(e) => {
              e.preventDefault();
              onLogout();
            }}
          >
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chess.com Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Chess.com Username</label>
            <Input
              placeholder="Enter your chess.com username"
              value={chessUsername}
              onChange={(e) => setChessUsername(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Enter your Chess.com username to fetch your stats and game history
            </p>
          </div>
          <Button 
            onClick={updateChessUsername} 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}