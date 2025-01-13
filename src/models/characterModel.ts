import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Race } from './raceModel.js';
import { User } from './userModel.js';

@Entity('characters')
export class Character {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.characters, { lazy: true, onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'userId' })
  user!: Promise<User>; 
  
  @Column()
  userId!: string;

  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({ type: 'varchar', length: 50 })
  surname!: string;

  @Column({ type: 'int' })
  age!: number;

  @Column({ type: 'varchar', length: 20 })
  gender!: 'male' | 'female' | 'other';

  @ManyToOne(() => Race, (race) => race.characters, { nullable: false, onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'raceId' })
  race!: Race;

  @Column({ type: 'json', default: {} })
  stats!: { STR: number; DEX: number; RES: number; MN: number; CHA: number };

  @Column({ type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ type: 'text', nullable: true })
  background!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
