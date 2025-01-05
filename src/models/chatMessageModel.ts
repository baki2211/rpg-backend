import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Location } from './locationModel.js';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Location, (location) => location.id, { onDelete: 'CASCADE' }) // Relationship to Location
  location!: Location;

  @Column()
  userId!: number; // ID of the user who sent the message

  @Column({ type: 'varchar', length: 100 })
  username!: string; // Username of the sender

  @Column({ type: 'text' })
  message!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
