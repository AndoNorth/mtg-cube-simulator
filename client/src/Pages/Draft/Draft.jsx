import React,{Component} from 'react';
import {Form, Button, ButtonToolbar, Table} from 'react-bootstrap';
import io from 'socket.io-client';

export class Draft extends Component{
  constructor(props){
    super(props);
    this.state={
      socket: null,
      session_id: localStorage.getItem('session_id') || '',
      player_name: localStorage.getItem('player_name') || '',
      token: localStorage.getItem('token') || '',
      players:[],
    };
    this.handleCreateSession=this.handleCreateSession.bind(this);
    this.handleJoinSession=this.handleJoinSession.bind(this);
  }

  initSocket = (event) => {
    event.preventDefault();
    
    const socket = io(import.meta.env.VITE_BACKEND_API);
    const {token, session_id, player_name} = this.state;
    // initialize socket + events
    this.setState({socket: socket}, () => {
      if (token) {
        socket.emit('authenticate', token);
      }

      socket.on('authenticated', (new_token) => {
        console.log('authenticated');
        if (new_token) {
          localStorage.setItem('token', new_token);
          this.setState({token : new_token });
        }
      });

      socket.on('playerJoined', (current_players) => {
        console.log(`${current_players}`);
        this.setState({players:current_players});
      });
    
      socket.on('sessionError', (error) => {
        console.error('Session error:', error);
      });
    });
  }

  handleInputChange = (event) => {
    const { name, value } = event.target;
    this.setState({ [name]: value }, () => {
      localStorage.setItem(name, value);
    });
  };

  handleCreateSession = (event) => {
    event.preventDefault();
    this.createSession();
    const { socket, session_id, player_name }=this.state;
    socket.emit('joinSession', session_id, player_name);
  };

  createSession = () => {
    const response = fetch(import.meta.env.VITE_BACKEND_API+'createSession', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(response=>response.json())
    .then(data=>{
      const { session_id } = data;
      this.setState({session_id: session_id});
      console.log(`session returned: ${session_id}`)
    },(error)=>{
      alert(error);
    });
  }

  handleJoinSession(event){
    event.preventDefault();
    const { socket, player_name }=this.state;
    const session_id = event.target.session_id.value;
    socket.emit('joinSession', session_id, player_name);
  };
  
  render(){
    const {socket, player_name, session_id, players} = this.state;

    return(
    <div>
      {socket == null &&
        <div>
        {player_name == null &&
          <Form onSubmit={this.initSocket}>
            <Form.Group>
              <Form.Control type="text" name="player_name" required onChange={this.handleInputChange} placeholder="Enter your name"/>
            </Form.Group>
            <Form.Group>
              <ButtonToolbar className="justify-content-center">
                <Button className="mr-2" variant="primary" type="submit">Connect to Server</Button>
              </ButtonToolbar>
            </Form.Group>
          </Form>
        }
        {player_name != null &&
          <Form onSubmit={this.initSocket}>
            <Form.Group>
              <ButtonToolbar className="justify-content-center">
                <Button className="mr-2" variant="primary" type="submit">Connect as "{player_name}"</Button>
              </ButtonToolbar>
            </Form.Group>
          </Form>
        }
        </div>
      }
      {socket != null && (
        <div>
          <h2>Draft Session</h2>
        {!session_id &&
          <div>
          <Form onSubmit={this.handleJoinSession}>
            <Form.Group>
              <Form.Control type="text" name="session_id" placeholder="Enter session id"/>
            </Form.Group> <br/>
            <Form.Group>
              <ButtonToolbar>
                <Button className="mr-2" variant="primary" type="submit">Join Session</Button>
                <Button className="mr-2" variant="danger" onClick={this.handleCreateSession}>Create Session</Button>
              </ButtonToolbar>
            </Form.Group>
          </Form>
          </div>
        }
        {session_id && (
          <div>
            <p>Session ID: {session_id}</p>
          {players.length > 0 && (
            <div>
            <Table className="mt-2" striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Players</th>
                  <th>Options</th>
                </tr>
              </thead>
              <tbody>
                {players.map((name) => (
                <tr>
                  <td>{name}</td>
                  <td>
                    <ButtonToolbar>
                      <Button className="mr-2" variant="danger"
                      onClick={()=>this.deleteTransaction(trans.id)}>
                        Ready
                      </Button>
                      <Button className="mr-2" variant="danger"
                      onClick={()=>this.deleteTransaction(trans.id)}>
                        Leave session
                      </Button>
                    </ButtonToolbar>
                  </td>
                </tr>
                ))}
              </tbody>
            </Table>
            <ul>
            </ul>
            </div>
            )}
          </div>
        )}
        </div>
      )}
    </div>
    );
  }
}