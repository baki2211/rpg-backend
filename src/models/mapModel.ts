import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('maps')
export class Map {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column()
  imageUrl!: string;

  @Column({ type: 'boolean', default: false }) 
  isMainMap!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
