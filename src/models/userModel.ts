import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  import { Character } from './characterModel.js';
  
  @Entity('users')
  export class User {
    @PrimaryGeneratedColumn()
    id!: number;
  
    @Column({ type: 'varchar', length: 50, unique: true })
    username!: string;
  
    @Column({ type: 'varchar', length: 255 })
    password!: string;
  
    @Column({ type: 'varchar', length: 20 })
    role!: string;
  
    @OneToMany(() => Character, (character) => character.user, { lazy: true })
    characters!: Promise<Character[]>; // Use lazy loading to resolve circular dependency
  
    @CreateDateColumn()
    createdAt!: Date;
  
    @UpdateDateColumn()
    updatedAt!: Date;
  }
  