import { useContext, useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import Logo from "./Logo";
import { UserContext } from "./UserContext";
import { uniqBy } from "lodash";
import axios from "axios";
import Contact from "./Contact";

export default function Chat() {
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState({});
    const [selectUserId, setSelectUserId] = useState(null);
    const { username, id, setId, setUsername } = useContext(UserContext);
    const [newMessagetxt, setNewMessagetxt] = useState("");
    const [messages, setMessages] = useState([]);
    const messageDivRef = useRef();
    useEffect(() => {
        connectToWs();
    }, []);
    function connectToWs() {
        const ws = new WebSocket('ws://localhost:4000');
        setWs(ws);
        ws.addEventListener('message', handleMessage);
        ws.addEventListener('close', () => {
            setTimeout(() => {
                console.log("Disconnected, Trying to reconnect!!");
                connectToWs();
            }, 1000);
        });
    }
    function logout() {
        axios.post('/logout').then(() => {
            setWs(null);
            setId(null);
            setUsername(null);
        })
    }

    function showOnlinePeople(peopleArray) {
        const people = {};
        peopleArray.forEach(({ userId, username }) => {
            people[userId] = username;
        });
        // console.log(people);
        setOnlinePeople(people);
    }
    function handleMessage(ev) {
        const messageData = JSON.parse(ev.data);
        console.log({ ev, messageData });
        // console.log('new message',e);
        if ('online' in messageData) {
            showOnlinePeople(messageData.online);
        }
        else if ('text' in messageData) {
            if(messageData.sender === selectUserId){
                setMessages(prev => ([...prev, { ...messageData }]));
            }
        }
    }
    function sendMessage(ev, file = null) {
        if (ev) ev.preventDefault();
        ws.send(JSON.stringify({
            recepient: selectUserId,
            text: newMessagetxt,
            file
        }));
        setNewMessagetxt('');
        setMessages(prev => ([...prev, {
            text: newMessagetxt,
            sender: id,
            recepient: selectUserId,
            _id: Date.now(),
        }]));
        if (file) {
            axios.get('/messages/' + selectUserId).then(res => {
                setMessages(res.data);
            });
        }
    }

    function sendFile(ev) {
        // console.log(ev.target.files);
        const reader = new FileReader();
        reader.readAsDataURL(ev.target.files[0]);
        reader.onload = () => {
            sendMessage(null, {
                name: ev.target.files[0].name,
                data: reader.result
            })
        }
    }

    useEffect(() => {
        const div = messageDivRef.current;
        if (div) {
            div.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages])

    useEffect(() => {
        axios.get('/people').then(res => {
            const offlinePeopleArr = res.data
                .filter(p => p._id != id)
                .filter(p => !Object.keys(onlinePeople).includes(p._id));
            const offlinePeople = {};
            offlinePeopleArr.forEach(p => {
                offlinePeople[p._id] = p;
            });
            setOfflinePeople(offlinePeople);
        });
    }, [onlinePeople]);

    useEffect(() => {
        if (selectUserId) {
            axios.get('/messages/' + selectUserId).then(res => {
                setMessages(res.data);
            });
        }
    }, [selectUserId])

    const OnlineUsersExcludingOwn = { ...onlinePeople };
    delete OnlineUsersExcludingOwn[id];

    const messagesOnce = uniqBy(messages, '_id')

    return (
        <div className="flex h-screen">
            <div className="bg-white-100 w-1/4 flex flex-col">
                <div className="flex-grow">
                    <Logo />
                    {Object.keys(OnlineUsersExcludingOwn).map(userId => (
                        <div key={userId} >
                            <Contact id={userId}
                                online={true}
                                username={OnlineUsersExcludingOwn[userId]}
                                onClick={() => setSelectUserId(userId)}
                                selected={userId === selectUserId} />
                        </div>

                    ))}
                    {Object.keys(offlinePeople).map(userId => (
                        <div key={userId} >
                            <Contact id={userId}
                                online={false}
                                username={offlinePeople[userId].username}
                                onClick={() => setSelectUserId(userId)}
                                selected={userId === selectUserId} />
                        </div>

                    ))}
                </div>
                <div className="text-center">
                    <span className="text-sm text-gray-400">Welcome {username}!!</span>
                </div>
                <div className="p-2 text-center">
                    <button onClick={logout} className="text-sm bg-green-400 py-1 px-2 text-gray-600 border rounded-lg">LogOut</button>
                </div>
            </div>
            <div className="flex flex-col bg-green-100 w-3/4 p-2">
                <div className="flex-grow" >
                    {!selectUserId && (
                        <div className="flex h-full flex-grow items-center justify-center">
                            <div className="text-lg text-gray-300">&larr; Select your friend and Chat... 👨‍💻</div>
                        </div>
                    )}
                    {!!selectUserId && (
                        <div className="relative h-full">
                            <div className="overflow-y-scroll absolute inset-0">
                                {messagesOnce.map(message => (
                                    <div key={message._id} className={(message.sender === id ? 'text-right' : 'text-left')}>
                                        <div className={"text-left inline-block p-2 my-2 text-sm rounded-md " + (message.sender === id ? 'bg-blue-500 text-white' : 'bg-white text-gray-500')}>
                                            {message.text}
                                            {
                                                message.file && (
                                                    <div>
                                                        <a target="_blank" className="flex items-center gap-1 border-b" href={axios.defaults.baseURL + '/attachments/' + message.file}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                                                            <path fill-rule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clip-rule="evenodd" />
                                                        </svg>
                                                            {message.file}
                                                        </a>
                                                    </div>
                                                )
                                            }
                                        </div>
                                    </div>
                                ))}
                                <div ref={messageDivRef}></div>
                            </div>
                        </div>


                    )}
                </div>
                {!!selectUserId && (
                    <form className="flex gap-2" onSubmit={sendMessage}>
                        <input type="text" value={newMessagetxt} onChange={ev => setNewMessagetxt(ev.target.value)} placeholder="Type message here..." className="bg-white flex-grow border p-2 rounded-sm" />
                        <label className="bg-green-200 p-2 text-gray rounded-sm border border-green-100 cursor-pointer">
                            <input type="file" className="hidden" onChange={sendFile}></input>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5">
                                <path fill-rule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clip-rule="evenodd" />
                            </svg>

                        </label>
                        <button type="submit" className="bg-green-500 p-2 text-white rounded-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                            </svg>

                        </button>
                    </form>
                )}

            </div>
        </div>
    );
}