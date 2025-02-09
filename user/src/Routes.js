import { useContext } from "react";
import { UserContext } from "./UserContext";
import RegisterandLogin from "./RegisterandLogin";
import Chat from "./Chat";

export default function Routes(){
    const {username, id} = useContext(UserContext);
    if(username){
        // return 'logged in Success!!, Hello '+ username;
        return <Chat/>
    }
    return (
        <RegisterandLogin />
    )
}