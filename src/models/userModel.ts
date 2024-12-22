import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users') // Explicitly naming the table
export class User {
    @PrimaryGeneratedColumn('uuid') // Using UUID instead of serial
    id!: string;

    @Column({
        type: 'varchar',
        length: 100,
        unique: true
    })
    username!: string;

    @Column({
        type: 'varchar',
        length: 255
    })
    password!: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updatedAt!: Date;
}
